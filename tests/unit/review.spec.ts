import 'fake-indexeddb/auto'

import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'

import { OctaReaderDatabase } from '@/data/database'
import type {
  ReviewSchedule,
  VocabularyContext,
  VocabularyEntry,
} from '@/data/models'
import { ReviewService, sentenceWithBlank } from '@/domain/review'

const names: string[] = []
const setup = () => {
  const name = `review-${crypto.randomUUID()}`
  names.push(name)
  const db = new OctaReaderDatabase(name)
  return { db, service: new ReviewService(db) }
}
afterEach(async () =>
  Promise.all(names.splice(0).map((name) => Dexie.delete(name))),
)

const addCard = async (
  db: OctaReaderDatabase,
  id: string,
  createdAt: number,
  schedule: Partial<ReviewSchedule> = {},
) => {
  const entry: VocabularyEntry = {
    id,
    identityKey: id,
    lemma: id,
    partOfSpeech: 'verb',
    sourceLanguage: 'en',
    targetLanguage: 'ru',
    createdAt,
    updatedAt: createdAt,
  }
  await db.vocabularyEntries.add(entry)
  await db.reviewSchedules.add({
    vocabularyEntryId: id,
    intervalDays: 0,
    dueAt: createdAt,
    lastReviewedAt: null,
    reviewCount: 0,
    lapseCount: 0,
    ...schedule,
  })
}

describe('ReviewService', () => {
  it('orders overdue reviewed cards before new cards, with new cards by creation', async () => {
    const { db, service } = setup()
    await addCard(db, 'new-later', 20)
    await addCard(db, 'overdue', 5, { reviewCount: 1, dueAt: 8 })
    await addCard(db, 'new-earlier', 10)
    expect((await service.due(30)).map(({ entry }) => entry.id)).toEqual([
      'overdue',
      'new-earlier',
      'new-later',
    ])
  })

  it('uses the latest context and masks its source form', async () => {
    const { db, service } = setup()
    await addCard(db, 'run', 1)
    const context: VocabularyContext = {
      id: 'context',
      vocabularyEntryId: 'run',
      sourceText: 'Running',
      translation: 'Бег',
      sentence: 'Running is fun.',
      bookId: null,
      bookTitle: 'Book',
      cfi: null,
      createdAt: 2,
    }
    await db.vocabularyContexts.add(context)
    expect((await service.due(2))[0]?.context).toEqual(context)
    expect(sentenceWithBlank(context)).toBe('_____ is fun.')
  })

  it('does not mask a source form inside another word', () => {
    const context: VocabularyContext = {
      id: 'context',
      vocabularyEntryId: 'he',
      sourceText: 'he',
      translation: 'он',
      sentence: 'She said he runs.',
      bookId: null,
      bookTitle: 'Book',
      cfi: null,
      createdAt: 1,
    }
    expect(sentenceWithBlank(context)).toBe('She said _____ runs.')
  })

  it('atomically updates the schedule and records a review event', async () => {
    const { db, service } = setup()
    await addCard(db, 'run', 1)
    const next = await service.rate('run', 'good', 100)
    expect(next.intervalDays).toBe(3)
    expect(await db.reviewSchedules.get('run')).toEqual(next)
    expect(
      await db.reviewEvents.where('vocabularyEntryId').equals('run').count(),
    ).toBe(1)
    expect(await service.due(100)).toEqual([])
  })
})

import 'fake-indexeddb/auto'

import Dexie from 'dexie'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { OctaReaderDatabase } from '@/data/database'
import { VocabularyService } from '@/domain/vocabulary'

const databaseNames: string[] = []

const setup = () => {
  const name = `vocabulary-${crypto.randomUUID()}`
  databaseNames.push(name)
  const db = new OctaReaderDatabase(name)
  return { db, service: new VocabularyService(db) }
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(databaseNames.splice(0).map((name) => Dexie.delete(name)))
})

const input = {
  sourceText: 'running',
  lemma: 'Run',
  partOfSpeech: 'verb' as const,
  translation: 'бежит',
  sentence: 'She is running home.',
  sourceLanguage: 'en',
  targetLanguage: 'ru',
  bookId: 'book-1',
  bookTitle: 'Test book',
  cfi: 'epubcfi(/6/2)',
}

describe('VocabularyService', () => {
  it('reuses a normalized identity and does not duplicate its context', async () => {
    const { db, service } = setup()
    vi.spyOn(Date, 'now').mockReturnValue(100)
    const first = await service.save(input)
    const second = await service.save({ ...input, lemma: ' run ' })

    expect(second.id).toBe(first.id)
    expect(await db.vocabularyEntries.count()).toBe(1)
    expect(await db.vocabularyContexts.count()).toBe(1)
    expect(await db.reviewSchedules.get(first.id)).toEqual({
      vocabularyEntryId: first.id,
      intervalDays: 0,
      dueAt: 100,
      lastReviewedAt: null,
      reviewCount: 0,
      lapseCount: 0,
    })
  })

  it('keeps different parts of speech as separate entries', async () => {
    const { db, service } = setup()
    await service.save(input)
    await service.save({ ...input, partOfSpeech: 'noun' })
    expect(await db.vocabularyEntries.count()).toBe(2)
  })

  it('adds a distinct contextual translation to an existing entry', async () => {
    const { db, service } = setup()
    const entry = await service.save(input)
    await service.save({
      ...input,
      sourceText: 'run',
      translation: 'управлять',
      sentence: 'She can run the company.',
      cfi: 'epubcfi(/6/4)',
    })
    expect(
      await db.vocabularyContexts
        .where('vocabularyEntryId')
        .equals(entry.id)
        .count(),
    ).toBe(2)
  })
})

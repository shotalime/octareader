import Dexie from 'dexie'

import { database, type OctaReaderDatabase } from '@/data/database'
import type {
  ReviewEvent,
  ReviewSchedule,
  VocabularyContext,
  VocabularyEntry,
} from '@/data/models'
import {
  isReviewDue,
  scheduleReview,
  type ReviewRating,
} from '@/domain/spaced-repetition'

export type ReviewCard = {
  entry: VocabularyEntry
  context: VocabularyContext | null
  schedule: ReviewSchedule
}

export const sentenceWithBlank = (
  context: VocabularyContext,
): string | null => {
  if (context.sentence === null) return null
  const escapedSource = context.sourceText.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  )
  const sourcePattern = new RegExp(
    `(?<![\\p{L}\\p{N}])${escapedSource}(?![\\p{L}\\p{N}])`,
    'iu',
  )
  return sourcePattern.test(context.sentence)
    ? context.sentence.replace(sourcePattern, '_____')
    : context.sentence
}

export class ReviewService {
  constructor(private readonly db: OctaReaderDatabase = database) {}

  async due(now = Date.now()): Promise<ReviewCard[]> {
    const schedules = await this.db.reviewSchedules
      .where('dueAt')
      .belowOrEqual(now)
      .toArray()
    const cards = await Promise.all(
      schedules
        .filter((schedule) => isReviewDue(schedule, now))
        .map(async (schedule) => {
          const entry = await this.db.vocabularyEntries.get(
            schedule.vocabularyEntryId,
          )
          if (entry === undefined) return null
          const context = await this.db.vocabularyContexts
            .where('[vocabularyEntryId+createdAt]')
            .between([entry.id, Dexie.minKey], [entry.id, Dexie.maxKey])
            .last()
          return { entry, context: context ?? null, schedule }
        }),
    )
    return cards
      .filter((card): card is ReviewCard => card !== null)
      .sort((left, right) => {
        const leftNew = left.schedule.reviewCount === 0
        const rightNew = right.schedule.reviewCount === 0
        if (leftNew !== rightNew) return leftNew ? 1 : -1
        return leftNew
          ? left.entry.createdAt - right.entry.createdAt
          : left.schedule.dueAt - right.schedule.dueAt
      })
  }

  async rate(
    entryId: string,
    rating: ReviewRating,
    reviewedAt = Date.now(),
  ): Promise<ReviewSchedule> {
    return this.db.transaction(
      'rw',
      [this.db.reviewSchedules, this.db.reviewEvents],
      async () => {
        const current = await this.db.reviewSchedules.get(entryId)
        if (current === undefined) throw new Error('Review schedule not found')
        const next = scheduleReview(current, rating, reviewedAt)
        const event: ReviewEvent = {
          id: crypto.randomUUID(),
          vocabularyEntryId: entryId,
          rating,
          reviewedAt,
          previousIntervalDays: current.intervalDays,
          nextIntervalDays: next.intervalDays,
          nextDueAt: next.dueAt,
        }
        await this.db.reviewSchedules.put(next)
        await this.db.reviewEvents.add(event)
        return next
      },
    )
  }
}

export const reviewService = new ReviewService()

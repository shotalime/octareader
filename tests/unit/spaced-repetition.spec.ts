import { describe, expect, it } from 'vitest'

import type { ReviewSchedule } from '@/data/models'
import {
  isReviewDue,
  scheduleReview,
  type ReviewRating,
} from '@/domain/spaced-repetition'

const initialSchedule = (intervalDays = 0): ReviewSchedule => ({
  vocabularyEntryId: 'entry-1',
  intervalDays,
  dueAt: 0,
  lastReviewedAt: null,
  reviewCount: 0,
  lapseCount: 0,
})

describe('scheduleReview', () => {
  it.each([
    ['again', 0, 10 * 60 * 1000],
    ['hard', 1, 24 * 60 * 60 * 1000],
    ['good', 3, 3 * 24 * 60 * 60 * 1000],
    ['easy', 7, 7 * 24 * 60 * 60 * 1000],
  ] as const)('applies the first %s rating', (rating, intervalDays, delay) => {
    const reviewedAt = new Date(2026, 0, 10, 14, 30).getTime()
    const result = scheduleReview(initialSchedule(), rating, reviewedAt)
    expect(result.intervalDays).toBe(intervalDays)
    expect(result.dueAt).toBe(reviewedAt + delay)
    expect(result.reviewCount).toBe(1)
    expect(result.lastReviewedAt).toBe(reviewedAt)
  })

  it.each([
    ['hard', 6],
    ['good', 10],
    ['easy', 14],
  ] as [ReviewRating, number][])(
    'multiplies a repeated %s rating',
    (rating, expected) => {
      expect(scheduleReview(initialSchedule(4), rating, 0).intervalDays).toBe(
        expected,
      )
    },
  )

  it('resets the interval and increments lapses after again', () => {
    const result = scheduleReview(
      { ...initialSchedule(12), reviewCount: 3, lapseCount: 1 },
      'again',
      1000,
    )
    expect(result).toMatchObject({
      intervalDays: 0,
      reviewCount: 4,
      lapseCount: 2,
    })
    expect(scheduleReview(result, 'good', result.dueAt).intervalDays).toBe(3)
  })

  it('adds calendar days while preserving the local time of day', () => {
    const reviewedAt = new Date(2026, 0, 31, 23, 45, 30).getTime()
    const result = scheduleReview(initialSchedule(), 'good', reviewedAt)
    const due = new Date(result.dueAt)
    expect([due.getFullYear(), due.getMonth(), due.getDate()]).toEqual([
      2026, 1, 3,
    ])
    expect([due.getHours(), due.getMinutes(), due.getSeconds()]).toEqual([
      23, 45, 30,
    ])
  })

  it('considers a review due at the exact due time', () => {
    const schedule = { ...initialSchedule(), dueAt: 500 }
    expect(isReviewDue(schedule, 499)).toBe(false)
    expect(isReviewDue(schedule, 500)).toBe(true)
  })
})

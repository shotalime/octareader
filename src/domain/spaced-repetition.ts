import type { ReviewSchedule } from '@/data/models'

export const REVIEW_RATINGS = ['again', 'hard', 'good', 'easy'] as const
export type ReviewRating = (typeof REVIEW_RATINGS)[number]

const nextInterval = (
  previousIntervalDays: number,
  rating: Exclude<ReviewRating, 'again'>,
): number => {
  switch (rating) {
    case 'hard':
      return Math.max(1, Math.round(previousIntervalDays * 1.5))
    case 'good':
      return Math.max(3, Math.round(previousIntervalDays * 2.5))
    case 'easy':
      return Math.max(7, Math.round(previousIntervalDays * 3.5))
  }
}

const addLocalCalendarDays = (timestamp: number, days: number): number => {
  const due = new Date(timestamp)
  due.setDate(due.getDate() + days)
  return due.getTime()
}

export const scheduleReview = (
  schedule: ReviewSchedule,
  rating: ReviewRating,
  reviewedAt: number,
): ReviewSchedule => {
  if (rating === 'again') {
    return {
      ...schedule,
      intervalDays: 0,
      dueAt: reviewedAt + 10 * 60 * 1000,
      lastReviewedAt: reviewedAt,
      reviewCount: schedule.reviewCount + 1,
      lapseCount: schedule.lapseCount + 1,
    }
  }

  const intervalDays = nextInterval(schedule.intervalDays, rating)
  return {
    ...schedule,
    intervalDays,
    dueAt: addLocalCalendarDays(reviewedAt, intervalDays),
    lastReviewedAt: reviewedAt,
    reviewCount: schedule.reviewCount + 1,
  }
}

export const isReviewDue = (schedule: ReviewSchedule, now: number): boolean =>
  schedule.dueAt <= now

export type EntityId = string

export type Book = {
  id: EntityId
  contentHash: string
  title: string
  author: string | null
  cover: Blob | null
  coverMediaType: string | null
  createdAt: number
  updatedAt: number
}

export type EpubFile = {
  bookId: EntityId
  file: Blob
}

export type BookLocations = {
  bookId: EntityId
  locations: string
  generatedAt: number
}

export type ReadingProgress = {
  bookId: EntityId
  cfi: string
  percentage: number | null
  updatedAt: number
}

export type Setting = {
  key: string
  value: unknown
  updatedAt: number
}

export type BookSetting = {
  bookId: EntityId
  sourceLanguage: string
  targetLanguage: string
  updatedAt: number
}

export type TranslationCacheEntry = {
  key: string
  normalizedSourceText: string
  normalizedSentence: string
  sourceLanguage: string
  targetLanguage: string
  provider: string
  model: string
  result: unknown
  createdAt: number
}

export type VocabularyEntry = {
  id: EntityId
  identityKey: string
  lemma: string
  partOfSpeech: string
  sourceLanguage: string
  targetLanguage: string
  createdAt: number
  updatedAt: number
}

export type VocabularyContext = {
  id: EntityId
  vocabularyEntryId: EntityId
  sourceText: string
  translation: string
  sentence: string | null
  bookId: EntityId | null
  bookTitle: string
  cfi: string | null
  createdAt: number
}

export type ReviewSchedule = {
  vocabularyEntryId: EntityId
  intervalDays: number
  dueAt: number
  lastReviewedAt: number | null
  reviewCount: number
  lapseCount: number
}

export type ReviewEvent = {
  id: EntityId
  vocabularyEntryId: EntityId
  rating: string
  reviewedAt: number
  previousIntervalDays: number
  nextIntervalDays: number
  nextDueAt: number
}

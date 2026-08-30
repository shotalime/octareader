import Dexie, { type EntityTable } from 'dexie'

import type {
  Book,
  BookLocations,
  BookSetting,
  EpubFile,
  ReadingProgress,
  ReviewEvent,
  ReviewSchedule,
  Setting,
  TranslationCacheEntry,
  VocabularyContext,
  VocabularyEntry,
} from './models'

export const DATABASE_NAME = 'octareader'
export const DATABASE_VERSION = 1

export class OctaReaderDatabase extends Dexie {
  books!: EntityTable<Book, 'id'>
  epubFiles!: EntityTable<EpubFile, 'bookId'>
  locations!: EntityTable<BookLocations, 'bookId'>
  readingProgress!: EntityTable<ReadingProgress, 'bookId'>
  settings!: EntityTable<Setting, 'key'>
  bookSettings!: EntityTable<BookSetting, 'bookId'>
  translationCache!: EntityTable<TranslationCacheEntry, 'key'>
  vocabularyEntries!: EntityTable<VocabularyEntry, 'id'>
  vocabularyContexts!: EntityTable<VocabularyContext, 'id'>
  reviewSchedules!: EntityTable<ReviewSchedule, 'vocabularyEntryId'>
  reviewEvents!: EntityTable<ReviewEvent, 'id'>

  constructor(name = DATABASE_NAME) {
    super(name)

    this.version(DATABASE_VERSION).stores({
      books: 'id,&contentHash,createdAt,updatedAt',
      epubFiles: 'bookId',
      locations: 'bookId',
      readingProgress: 'bookId,updatedAt',
      settings: 'key,updatedAt',
      bookSettings: 'bookId,updatedAt',
      translationCache:
        'key,[normalizedSourceText+normalizedSentence+sourceLanguage+targetLanguage+provider+model],createdAt',
      vocabularyEntries:
        'id,&identityKey,[sourceLanguage+targetLanguage],createdAt,updatedAt',
      vocabularyContexts:
        'id,vocabularyEntryId,bookId,[vocabularyEntryId+createdAt],createdAt',
      reviewSchedules: 'vocabularyEntryId,dueAt',
      reviewEvents:
        'id,vocabularyEntryId,[vocabularyEntryId+reviewedAt],reviewedAt',
    })
  }
}

export const database = new OctaReaderDatabase()

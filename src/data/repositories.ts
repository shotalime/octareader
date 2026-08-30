import type { EntityTable, IDType } from 'dexie'

import { database, type OctaReaderDatabase } from './database'
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

export class Repository<TEntity, TKey extends keyof TEntity> {
  constructor(private readonly table: EntityTable<TEntity, TKey>) {}

  async get(key: IDType<TEntity, TKey>): Promise<TEntity | undefined> {
    return this.table.get(key)
  }

  async getAll(): Promise<TEntity[]> {
    return this.table.toArray()
  }

  async put(entity: TEntity): Promise<IDType<TEntity, TKey>> {
    return this.table.put(entity)
  }

  async delete(key: IDType<TEntity, TKey>): Promise<void> {
    await this.table.delete(key)
  }

  async clear(): Promise<void> {
    await this.table.clear()
  }
}

export type Repositories = ReturnType<typeof createRepositories>

export const createRepositories = (db: OctaReaderDatabase = database) => ({
  books: new Repository<Book, 'id'>(db.books),
  epubFiles: new Repository<EpubFile, 'bookId'>(db.epubFiles),
  locations: new Repository<BookLocations, 'bookId'>(db.locations),
  readingProgress: new Repository<ReadingProgress, 'bookId'>(
    db.readingProgress,
  ),
  settings: new Repository<Setting, 'key'>(db.settings),
  bookSettings: new Repository<BookSetting, 'bookId'>(db.bookSettings),
  translationCache: new Repository<TranslationCacheEntry, 'key'>(
    db.translationCache,
  ),
  vocabularyEntries: new Repository<VocabularyEntry, 'id'>(
    db.vocabularyEntries,
  ),
  vocabularyContexts: new Repository<VocabularyContext, 'id'>(
    db.vocabularyContexts,
  ),
  reviewSchedules: new Repository<ReviewSchedule, 'vocabularyEntryId'>(
    db.reviewSchedules,
  ),
  reviewEvents: new Repository<ReviewEvent, 'id'>(db.reviewEvents),
})

export const repositories = createRepositories()

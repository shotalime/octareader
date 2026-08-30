import { database, type OctaReaderDatabase } from '@/data/database'
import type { Book } from '@/data/models'
import { BookImportService, type BookImportResult } from '@/domain/book-import'

export type LibraryBook = Book & { progressPercentage: number | null }

export class LibraryService {
  private readonly importer: BookImportService

  constructor(private readonly db: OctaReaderDatabase = database) {
    this.importer = new BookImportService(db)
  }

  async listBooks(): Promise<LibraryBook[]> {
    const books = await this.db.books.orderBy('createdAt').reverse().toArray()
    const progressRecords = await this.db.readingProgress.bulkGet(
      books.map(({ id }) => id),
    )
    return books.map((book, index) => ({
      ...book,
      progressPercentage: progressRecords[index]?.percentage ?? null,
    }))
  }

  async importBook(file: File): Promise<BookImportResult> {
    return this.importer.import(file)
  }

  async deleteBook(bookId: string): Promise<void> {
    await this.db.transaction(
      'rw',
      [
        this.db.books,
        this.db.epubFiles,
        this.db.locations,
        this.db.readingProgress,
        this.db.bookSettings,
      ],
      async () => {
        await Promise.all([
          this.db.books.delete(bookId),
          this.db.epubFiles.delete(bookId),
          this.db.locations.delete(bookId),
          this.db.readingProgress.delete(bookId),
          this.db.bookSettings.delete(bookId),
        ])
      },
    )
  }
}

export const libraryService = new LibraryService()

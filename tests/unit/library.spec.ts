import 'fake-indexeddb/auto'

import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'

import { OctaReaderDatabase } from '@/data/database'
import type { Book, VocabularyContext, VocabularyEntry } from '@/data/models'
import { LibraryService } from '@/domain/library'

const databaseNames: string[] = []

afterEach(async () => {
  await Promise.all(databaseNames.splice(0).map((name) => Dexie.delete(name)))
})

const createDatabase = (): OctaReaderDatabase => {
  const name = `library-test-${crypto.randomUUID()}`
  databaseNames.push(name)
  return new OctaReaderDatabase(name)
}

const book: Book = {
  id: 'book-1',
  contentHash: 'hash',
  title: 'Book',
  author: null,
  cover: null,
  coverMediaType: null,
  createdAt: 1,
  updatedAt: 1,
}

describe('LibraryService', () => {
  it('restores books and their persisted progress', async () => {
    const db = createDatabase()
    await db.books.add(book)
    await db.readingProgress.add({
      bookId: book.id,
      cfi: 'epubcfi(/6/2)',
      percentage: 37,
      updatedAt: 2,
    })
    db.close()

    const reopened = new OctaReaderDatabase(db.name)
    await expect(new LibraryService(reopened).listBooks()).resolves.toEqual([
      { ...book, progressPercentage: 37 },
    ])
    reopened.close()
  })

  it('deletes book data but preserves vocabulary and textual context', async () => {
    const db = createDatabase()
    const entry: VocabularyEntry = {
      id: 'word-1',
      identityKey: 'word|noun|en|ru',
      lemma: 'word',
      partOfSpeech: 'noun',
      sourceLanguage: 'en',
      targetLanguage: 'ru',
      createdAt: 1,
      updatedAt: 1,
    }
    const context: VocabularyContext = {
      id: 'context-1',
      vocabularyEntryId: entry.id,
      sourceText: 'word',
      translation: 'слово',
      sentence: 'A word remains.',
      bookId: book.id,
      bookTitle: book.title,
      cfi: 'epubcfi(/6/2)',
      createdAt: 1,
    }
    await db.books.add(book)
    await db.epubFiles.add({ bookId: book.id, file: new Blob(['epub']) })
    await db.vocabularyEntries.add(entry)
    await db.vocabularyContexts.add(context)

    await new LibraryService(db).deleteBook(book.id)

    expect(await db.books.get(book.id)).toBeUndefined()
    expect(await db.epubFiles.get(book.id)).toBeUndefined()
    expect(await db.vocabularyEntries.get(entry.id)).toEqual(entry)
    expect(await db.vocabularyContexts.get(context.id)).toEqual(context)
    db.close()
  })
})

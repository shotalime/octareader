import 'fake-indexeddb/auto'

import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'

import { DATABASE_VERSION, OctaReaderDatabase } from '@/data/database'
import { createRepositories } from '@/data/repositories'
import type { Book } from '@/data/models'

const databaseNames: string[] = []

const createDatabase = (): OctaReaderDatabase => {
  const name = `octareader-test-${crypto.randomUUID()}`
  databaseNames.push(name)
  return new OctaReaderDatabase(name)
}

afterEach(async () => {
  await Promise.all(databaseNames.splice(0).map((name) => Dexie.delete(name)))
})

describe('OctaReaderDatabase', () => {
  it('creates every versioned store', async () => {
    const db = createDatabase()
    await db.open()

    expect(db.verno).toBe(DATABASE_VERSION)
    expect(db.tables.map(({ name }) => name).sort()).toEqual([
      'bookSettings',
      'books',
      'epubFiles',
      'locations',
      'readingProgress',
      'reviewEvents',
      'reviewSchedules',
      'settings',
      'translationCache',
      'vocabularyContexts',
      'vocabularyEntries',
    ])
    db.close()
  })

  it('supports CRUD and preserves records after reopening', async () => {
    const db = createDatabase()
    const repositories = createRepositories(db)
    const book: Book = {
      id: 'book-1',
      contentHash: 'sha256-content',
      title: 'Test Book',
      author: null,
      cover: null,
      coverMediaType: null,
      createdAt: 1,
      updatedAt: 1,
    }

    await repositories.books.put(book)
    expect(await repositories.books.get(book.id)).toEqual(book)
    db.close()

    const reopened = new OctaReaderDatabase(db.name)
    const reopenedRepositories = createRepositories(reopened)
    expect(await reopenedRepositories.books.getAll()).toEqual([book])

    await reopenedRepositories.books.delete(book.id)
    expect(await reopenedRepositories.books.get(book.id)).toBeUndefined()
    reopened.close()
  })
})

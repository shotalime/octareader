import 'fake-indexeddb/auto'

import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'

import { OctaReaderDatabase } from '@/data/database'
import type { Book, TranslationCacheEntry } from '@/data/models'
import { API_KEY_SETTING_KEY } from '@/domain/api-key'
import { LocalDataService } from '@/domain/local-data'

const databaseNames: string[] = []

const createDatabase = (): OctaReaderDatabase => {
  const name = `octareader-local-data-${crypto.randomUUID()}`
  databaseNames.push(name)
  return new OctaReaderDatabase(name)
}

afterEach(async () => {
  await Promise.all(databaseNames.splice(0).map((name) => Dexie.delete(name)))
})

describe('LocalDataService', () => {
  it('clears every store while leaving the database ready for reuse', async () => {
    const db = createDatabase()
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
    await db.books.put(book)
    await db.settings.put({
      key: API_KEY_SETTING_KEY,
      value: { apiKey: 'secret' },
      updatedAt: 1,
    })
    await db.translationCache.put({
      key: 'cache-key',
      normalizedSourceText: 'word',
      normalizedSentence: '',
      sourceLanguage: 'en',
      targetLanguage: 'ru',
      provider: 'gemini',
      model: 'test-model',
      result: {
        schemaVersion: 1,
        status: 'translated',
        sourceText: 'word',
        lemma: 'word',
        partOfSpeech: 'noun',
        translation: 'слово',
      },
      createdAt: 1,
    } satisfies TranslationCacheEntry)

    await new LocalDataService(db).clearAll()

    await Promise.all(
      db.tables.map(async (table) => {
        expect(await table.count(), table.name).toBe(0)
      }),
    )
    await db.books.put({ ...book, id: 'book-2', contentHash: 'hash-2' })
    expect(await db.books.count()).toBe(1)
    db.close()
  })

  it('deleting only the API key preserves cached translations', async () => {
    const db = createDatabase()
    await db.settings.put({
      key: API_KEY_SETTING_KEY,
      value: { apiKey: 'secret' },
      updatedAt: 1,
    })
    await db.translationCache.put({
      key: 'cache-key',
      normalizedSourceText: 'word',
      normalizedSentence: '',
      sourceLanguage: 'en',
      targetLanguage: 'ru',
      provider: 'gemini',
      model: 'test-model',
      result: {
        schemaVersion: 1,
        status: 'translated',
        sourceText: 'word',
        lemma: 'word',
        partOfSpeech: 'noun',
        translation: 'слово',
      },
      createdAt: 1,
    })

    await db.settings.delete(API_KEY_SETTING_KEY)

    expect(await db.settings.get(API_KEY_SETTING_KEY)).toBeUndefined()
    expect(await db.translationCache.get('cache-key')).toBeDefined()
    db.close()
  })
})

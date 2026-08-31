import 'fake-indexeddb/auto'

import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'

import {
  DEFAULT_AI_MAX_OUTPUT_TOKENS,
  DEFAULT_AI_MODEL,
} from '@/config/ai'
import { OctaReaderDatabase } from '@/data/database'
import {
  DEFAULT_READER_APPEARANCE,
  SettingsRepository,
  type ReaderAppearanceSettings,
} from '@/domain/settings'

const databaseNames: string[] = []

afterEach(async () => {
  await Promise.all(databaseNames.splice(0).map((name) => Dexie.delete(name)))
})

const createDatabase = (): OctaReaderDatabase => {
  const name = `settings-test-${crypto.randomUUID()}`
  databaseNames.push(name)
  return new OctaReaderDatabase(name)
}

describe('SettingsRepository', () => {
  it('returns safe defaults for a new installation', async () => {
    const db = createDatabase()
    const repository = new SettingsRepository(db)

    expect(await repository.getReaderAppearance()).toEqual(
      DEFAULT_READER_APPEARANCE,
    )
    db.close()
  })

  it('persists global reader appearance after reopening', async () => {
    const db = createDatabase()
    const settings: ReaderAppearanceSettings = {
      fontSizePercent: 120,
      fontFamily: 'sans-serif',
      lineHeight: 1.8,
      marginPercent: 12,
      theme: 'dark',
    }

    await new SettingsRepository(db).saveReaderAppearance(settings, 100)
    db.close()

    const reopened = new OctaReaderDatabase(db.name)
    expect(
      await new SettingsRepository(reopened).getReaderAppearance(),
    ).toEqual(settings)
    reopened.close()
  })

  it('stores translation directions independently for each book', async () => {
    const db = createDatabase()
    const repository = new SettingsRepository(db)

    await repository.saveBookLanguages('book-1', 'en', 'ru', 1)
    await repository.saveBookLanguages('book-2', 'de', 'ru', 2)

    expect(await repository.getBookLanguages('book-1')).toMatchObject({
      sourceLanguage: 'en',
      targetLanguage: 'ru',
    })
    expect(await repository.getBookLanguages('book-2')).toMatchObject({
      sourceLanguage: 'de',
      targetLanguage: 'ru',
    })
    db.close()
  })

  it('normalizes canonical language codes before persistence', async () => {
    const db = createDatabase()
    const repository = new SettingsRepository(db)

    await repository.saveBookLanguages('book-1', 'iw', 'zh-TW', 1)

    expect(await repository.getBookLanguages('book-1')).toMatchObject({
      sourceLanguage: 'he',
      targetLanguage: 'zh-Hant',
    })
    db.close()
  })
})

describe('AI configuration', () => {
  it('exposes the configured default model', () => {
    expect(DEFAULT_AI_MODEL).toBe('gemini-3.5-flash-lite')
    expect(DEFAULT_AI_MAX_OUTPUT_TOKENS).toBe(1024)
  })
})

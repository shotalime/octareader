import type { OctaReaderDatabase } from '@/data/database'
import { database } from '@/data/database'
import type { BookSetting, Setting } from '@/data/models'

export const APPLICATION_SETTINGS_KEY = 'application-settings'

export type FontFamily = 'serif' | 'sans-serif'
export type ReaderTheme = 'light' | 'dark'

export type ReaderAppearanceSettings = {
  fontSizePercent: number
  fontFamily: FontFamily
  lineHeight: number
  marginPercent: number
  theme: ReaderTheme
}

export const DEFAULT_READER_APPEARANCE: Readonly<ReaderAppearanceSettings> = {
  fontSizePercent: 100,
  fontFamily: 'serif',
  lineHeight: 1.6,
  marginPercent: 8,
  theme: 'light',
}

const isReaderAppearanceSettings = (
  value: unknown,
): value is ReaderAppearanceSettings => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Partial<ReaderAppearanceSettings>
  return (
    typeof candidate.fontSizePercent === 'number' &&
    (candidate.fontFamily === 'serif' ||
      candidate.fontFamily === 'sans-serif') &&
    typeof candidate.lineHeight === 'number' &&
    typeof candidate.marginPercent === 'number' &&
    (candidate.theme === 'light' || candidate.theme === 'dark')
  )
}

export class SettingsRepository {
  constructor(private readonly db: OctaReaderDatabase = database) {}

  async getReaderAppearance(): Promise<ReaderAppearanceSettings> {
    const record = await this.db.settings.get(APPLICATION_SETTINGS_KEY)
    return isReaderAppearanceSettings(record?.value)
      ? record.value
      : { ...DEFAULT_READER_APPEARANCE }
  }

  async saveReaderAppearance(
    value: ReaderAppearanceSettings,
    updatedAt = Date.now(),
  ): Promise<void> {
    const record: Setting = {
      key: APPLICATION_SETTINGS_KEY,
      value,
      updatedAt,
    }
    await this.db.settings.put(record)
  }

  async getBookLanguages(bookId: string): Promise<BookSetting | undefined> {
    return this.db.bookSettings.get(bookId)
  }

  async saveBookLanguages(
    bookId: string,
    sourceLanguage: string,
    targetLanguage: string,
    updatedAt = Date.now(),
  ): Promise<void> {
    await this.db.bookSettings.put({
      bookId,
      sourceLanguage,
      targetLanguage,
      updatedAt,
    })
  }
}

export const settingsRepository = new SettingsRepository()

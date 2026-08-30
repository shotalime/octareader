import 'fake-indexeddb/auto'

import Dexie from 'dexie'
import { Blob as NodeBlob } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { OctaReaderDatabase } from '@/data/database'
import type { Book } from '@/data/models'
import { ReaderService } from '@/domain/reader'

type RelocatedListener = (location: { start: { cfi: string } }) => void

const mocks = vi.hoisted(() => ({
  listeners: [] as RelocatedListener[],
  display: vi.fn(),
  destroyRendition: vi.fn(),
  destroyBook: vi.fn(),
  loadLocations: vi.fn(),
  saveLocations: vi.fn(() => '["epubcfi(/6/2)"]'),
  generateLocations: vi.fn(),
  locationsLength: vi.fn(() => 10),
  percentageFromCfi: vi.fn(() => 0.25),
  epubFactory: vi.fn(),
  registerTheme: vi.fn(),
  selectTheme: vi.fn(),
  setFontSize: vi.fn(),
  setFont: vi.fn(),
}))

vi.mock('epubjs', () => ({ default: mocks.epubFactory }))

const databaseNames: string[] = []
const createDatabase = (): OctaReaderDatabase => {
  const name = `reader-test-${crypto.randomUUID()}`
  databaseNames.push(name)
  return new OctaReaderDatabase(name)
}

const bookRecord: Book = {
  id: 'book-1',
  contentHash: 'hash',
  title: 'Book',
  author: null,
  cover: null,
  coverMediaType: null,
  createdAt: 1,
  updatedAt: 1,
}
const epubBlob = (): Blob => new NodeBlob(['epub']) as unknown as Blob

beforeEach(() => {
  mocks.listeners.length = 0
  mocks.display.mockReset().mockResolvedValue(undefined)
  mocks.destroyRendition.mockReset()
  mocks.destroyBook.mockReset()
  mocks.loadLocations.mockReset()
  mocks.generateLocations.mockReset().mockResolvedValue([])
  mocks.locationsLength.mockReset().mockReturnValue(10)
  mocks.percentageFromCfi.mockReset().mockReturnValue(0.25)
  mocks.registerTheme.mockReset()
  mocks.selectTheme.mockReset()
  mocks.setFontSize.mockReset()
  mocks.setFont.mockReset()
  mocks.epubFactory.mockReset().mockReturnValue({
    opened: Promise.resolve(),
    loaded: { navigation: Promise.resolve({ toc: [] }) },
    locations: {
      load: mocks.loadLocations,
      save: mocks.saveLocations,
      generate: mocks.generateLocations,
      length: mocks.locationsLength,
      percentageFromCfi: mocks.percentageFromCfi,
    },
    renderTo: () => ({
      display: mocks.display,
      next: vi.fn(),
      prev: vi.fn(),
      destroy: mocks.destroyRendition,
      location: { start: { index: 0 } },
      themes: {
        register: mocks.registerTheme,
        select: mocks.selectTheme,
        fontSize: mocks.setFontSize,
        font: mocks.setFont,
      },
      on: (_event: string, listener: RelocatedListener) =>
        mocks.listeners.push(listener),
      off: (_event: string, listener: RelocatedListener) => {
        const index = mocks.listeners.indexOf(listener)
        if (index >= 0) mocks.listeners.splice(index, 1)
      },
    }),
    spine: { get: () => ({ href: 'chapter.xhtml' }) },
    destroy: mocks.destroyBook,
  })
})

afterEach(async () => {
  vi.useRealTimers()
  await Promise.all(databaseNames.splice(0).map((name) => Dexie.delete(name)))
})

describe('ReaderService progress', () => {
  it('restores CFI and persists relocated progress after 750 ms', async () => {
    const db = createDatabase()
    await db.books.add(bookRecord)
    await db.epubFiles.add({ bookId: bookRecord.id, file: epubBlob() })
    await db.locations.add({
      bookId: bookRecord.id,
      locations: '["saved"]',
      generatedAt: 1,
    })
    await db.readingProgress.add({
      bookId: bookRecord.id,
      cfi: 'epubcfi(/6/2)',
      percentage: 10,
      updatedAt: 1,
    })

    const session = await new ReaderService(db).open(
      bookRecord.id,
      document.createElement('div'),
    )
    expect(mocks.loadLocations).toHaveBeenCalledWith('["saved"]')
    expect(mocks.display).toHaveBeenCalledWith('epubcfi(/6/2)')
    expect(mocks.setFontSize).toHaveBeenCalledWith('100%')

    vi.useFakeTimers()
    mocks.listeners[0]?.({ start: { cfi: 'epubcfi(/6/4)' } })
    expect(mocks.percentageFromCfi).toHaveBeenCalledWith('epubcfi(/6/4)')
    vi.advanceTimersByTime(750)
    vi.useRealTimers()
    expect(await db.readingProgress.get(bookRecord.id)).toMatchObject({
      cfi: 'epubcfi(/6/4)',
      percentage: 25,
    })
    await session.destroy()
    db.close()
  })

  it('flushes the pending CFI when the reader closes', async () => {
    const db = createDatabase()
    await db.books.add(bookRecord)
    await db.epubFiles.add({ bookId: bookRecord.id, file: epubBlob() })
    await db.locations.add({
      bookId: bookRecord.id,
      locations: '["saved"]',
      generatedAt: 1,
    })
    const session = await new ReaderService(db).open(
      bookRecord.id,
      document.createElement('div'),
    )
    mocks.listeners[0]?.({ start: { cfi: 'epubcfi(/6/8)' } })
    await session.destroy()
    expect((await db.readingProgress.get(bookRecord.id))?.cfi).toBe(
      'epubcfi(/6/8)',
    )
    db.close()
  })
})

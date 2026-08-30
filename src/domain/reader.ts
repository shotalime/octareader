import ePub from 'epubjs'
import type Book from 'epubjs/types/book'
import type Rendition from 'epubjs/types/rendition'
import type { NavItem } from 'epubjs/types/navigation'

import { database, type OctaReaderDatabase } from '@/data/database'
import type { ReadingProgress } from '@/data/models'
import { registerEpubTapDetection } from '@/domain/epub-tap'
import {
  SettingsRepository,
  type ReaderAppearanceSettings,
} from '@/domain/settings'
import type { TappedText } from '@/domain/text-selection'

export const READER_ERROR_MESSAGE =
  'Не удалось открыть книгу. Возможно, файл повреждён или имеет неподдерживаемый формат.'

export type ReaderSession = {
  title: string
  author: string | null
  nextPage: () => Promise<void>
  previousPage: () => Promise<void>
  nextChapter: () => Promise<void>
  previousChapter: () => Promise<void>
  tableOfContents: TableOfContentsItem[]
  appearance: ReaderAppearanceSettings
  goTo: (href: string) => Promise<void>
  destroy: () => Promise<void>
}

export type ReaderState = {
  cfi: string | null
  progressPercentage: number | null
  isProgressCalculating: boolean
}

type ReaderLocation = { start: { cfi: string } }
type RenditionEvents = {
  on: (event: 'relocated', listener: (location: ReaderLocation) => void) => void
  off: (
    event: 'relocated',
    listener: (location: ReaderLocation) => void,
  ) => void
}

const progressFromCfi = (book: Book, cfi: string): number | null => {
  if (book.locations.length() === 0) return null
  try {
    const percentage = book.locations.percentageFromCfi(cfi) * 100
    return Math.min(100, Math.max(0, percentage))
  } catch {
    return null
  }
}

const applyAppearance = (
  rendition: Rendition,
  settings: ReaderAppearanceSettings,
): void => {
  const dark = settings.theme === 'dark'
  rendition.themes.register('octareader', {
    body: {
      color: dark ? '#e7e5e4' : '#292524',
      background: dark ? '#1c1917' : '#fffdf7',
      'line-height': `${settings.lineHeight} !important`,
      'padding-left': `${settings.marginPercent}% !important`,
      'padding-right': `${settings.marginPercent}% !important`,
    },
    a: { color: dark ? '#86efac' : '#166534' },
  })
  rendition.themes.select('octareader')
  rendition.themes.fontSize(`${settings.fontSizePercent}%`)
  rendition.themes.font(
    settings.fontFamily === 'serif'
      ? 'Georgia, Cambria, serif'
      : 'Inter, Arial, sans-serif',
  )
}

export type TableOfContentsItem = {
  id: string
  href: string
  label: string
  children: TableOfContentsItem[]
}

const toTableOfContentsItem = (item: NavItem): TableOfContentsItem => ({
  id: item.id,
  href: item.href,
  label: item.label.trim(),
  children: (item.subitems ?? []).map(toTableOfContentsItem),
})

const loadTableOfContents = async (
  book: Book,
): Promise<TableOfContentsItem[]> => {
  try {
    const navigation = await Promise.race([
      book.loaded.navigation,
      new Promise<null>((resolve) =>
        window.setTimeout(() => resolve(null), 1000),
      ),
    ])
    if (navigation === null) return []
    return navigation.toc
      .map(toTableOfContentsItem)
      .filter((item) => item.label.length > 0 && item.href.length > 0)
  } catch {
    return []
  }
}

const chapterHref = (
  book: Book,
  rendition: Rendition,
  offset: -1 | 1,
): string | null => {
  const index = rendition.location.start.index + offset
  if (index < 0) return null
  const section = book.spine.get(index)
  return section?.href ?? null
}

export class ReaderService {
  private readonly settings: SettingsRepository

  constructor(private readonly db: OctaReaderDatabase = database) {
    this.settings = new SettingsRepository(db)
  }

  private async storeLocations(
    bookId: string,
    locations: string,
  ): Promise<void> {
    await this.db.transaction(
      'rw',
      [this.db.books, this.db.locations],
      async () => {
        if ((await this.db.books.get(bookId)) === undefined) return
        await this.db.locations.put({
          bookId,
          locations,
          generatedAt: Date.now(),
        })
      },
    )
  }

  async prepareLocations(bookId: string): Promise<void> {
    let book: Book | null = null
    try {
      if ((await this.db.locations.get(bookId)) !== undefined) return
      const fileRecord = await this.db.epubFiles.get(bookId)
      if (fileRecord === undefined) return
      book = ePub(await fileRecord.file.arrayBuffer())
      await book.opened
      await book.locations.generate(1600)
      await this.storeLocations(bookId, book.locations.save())
    } catch {
      // Reading retries generation on the next open; import remains successful.
    } finally {
      book?.destroy()
    }
  }

  async open(
    bookId: string,
    element: HTMLElement,
    onState: (state: ReaderState) => void = () => undefined,
    onTextTap: (selection: TappedText) => void = () => undefined,
  ): Promise<ReaderSession> {
    const [bookRecord, fileRecord] = await Promise.all([
      this.db.books.get(bookId),
      this.db.epubFiles.get(bookId),
    ])
    if (bookRecord === undefined || fileRecord === undefined) {
      throw new Error(READER_ERROR_MESSAGE)
    }

    const [savedLocations, savedProgress, appearance, bookLanguages] =
      await Promise.all([
        this.db.locations.get(bookId),
        this.db.readingProgress.get(bookId),
        this.settings.getReaderAppearance(),
        this.settings.getBookLanguages(bookId),
      ])

    let book: Book | null = null
    let rendition: Rendition | null = null
    let removeTapDetection = (): void => undefined
    try {
      book = ePub(await fileRecord.file.arrayBuffer())
      await book.opened
      if (savedLocations !== undefined) {
        try {
          book.locations.load(savedLocations.locations)
        } catch {
          // A corrupt map is regenerated below without blocking reading.
        }
      }
      rendition = book.renderTo(element, {
        width: '100%',
        height: '100%',
        flow: 'paginated',
        spread: 'auto',
      })
      applyAppearance(rendition, appearance)
      removeTapDetection = registerEpubTapDetection(
        rendition,
        bookLanguages?.sourceLanguage ||
          book.packaging.metadata.language ||
          'und',
        onTextTap,
      )
      try {
        await rendition.display(savedProgress?.cfi)
      } catch {
        await rendition.display()
      }
    } catch {
      removeTapDetection()
      rendition?.destroy()
      book?.destroy()
      throw new Error(READER_ERROR_MESSAGE)
    }

    const openedBook = book
    const openedRendition = rendition
    const renditionEvents = openedRendition as unknown as RenditionEvents
    let latestCfi = savedProgress?.cfi ?? null
    let pendingProgress: ReadingProgress | null = null
    let saveTimer: number | null = null
    let active = true

    const emitState = (): void => {
      onState({
        cfi: latestCfi,
        progressPercentage:
          latestCfi === null ? null : progressFromCfi(openedBook, latestCfi),
        isProgressCalculating: openedBook.locations.length() === 0,
      })
    }
    const flushProgress = async (): Promise<void> => {
      if (saveTimer !== null) {
        window.clearTimeout(saveTimer)
        saveTimer = null
      }
      const record = pendingProgress
      pendingProgress = null
      if (record !== null) {
        try {
          await this.db.readingProgress.put(record)
        } catch {
          if (pendingProgress === null) pendingProgress = record
        }
      }
    }
    const relocated = (location: ReaderLocation): void => {
      latestCfi = location.start.cfi
      pendingProgress = {
        bookId,
        cfi: latestCfi,
        percentage: progressFromCfi(openedBook, latestCfi),
        updatedAt: Date.now(),
      }
      if (saveTimer !== null) window.clearTimeout(saveTimer)
      saveTimer = window.setTimeout(() => void flushProgress(), 750)
      emitState()
    }
    const visibilityChanged = (): void => {
      if (document.visibilityState === 'hidden') void flushProgress()
    }
    renditionEvents.on('relocated', relocated)
    document.addEventListener('visibilitychange', visibilityChanged)
    emitState()

    if (openedBook.locations.length() === 0) {
      void (async () => {
        try {
          await openedBook.locations.generate(1600)
          await this.storeLocations(bookId, openedBook.locations.save())
          if (latestCfi !== null) {
            pendingProgress = {
              bookId,
              cfi: latestCfi,
              percentage: progressFromCfi(openedBook, latestCfi),
              updatedAt: Date.now(),
            }
            if (saveTimer !== null) window.clearTimeout(saveTimer)
            saveTimer = window.setTimeout(() => void flushProgress(), 750)
          }
          if (active) emitState()
        } catch {
          // The next reader open retries generation.
        }
      })()
    }
    const displayChapter = async (offset: -1 | 1): Promise<void> => {
      const href = chapterHref(openedBook, openedRendition, offset)
      if (href !== null) await openedRendition.display(href)
    }

    const tableOfContents = await loadTableOfContents(openedBook)

    return {
      title: bookRecord.title,
      author: bookRecord.author,
      nextPage: async () => openedRendition.next(),
      previousPage: async () => openedRendition.prev(),
      nextChapter: async () => displayChapter(1),
      previousChapter: async () => displayChapter(-1),
      tableOfContents,
      appearance,
      goTo: async (href: string) => openedRendition.display(href),
      destroy: async () => {
        active = false
        renditionEvents.off('relocated', relocated)
        document.removeEventListener('visibilitychange', visibilityChanged)
        removeTapDetection()
        await flushProgress()
        openedRendition.destroy()
        openedBook.destroy()
      },
    }
  }
}

export const readerService = new ReaderService()

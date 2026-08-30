import ePub from 'epubjs'
import type Book from 'epubjs/types/book'
import type Rendition from 'epubjs/types/rendition'
import type { NavItem } from 'epubjs/types/navigation'

import { database, type OctaReaderDatabase } from '@/data/database'

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
  goTo: (href: string) => Promise<void>
  destroy: () => void
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
  constructor(private readonly db: OctaReaderDatabase = database) {}

  async open(bookId: string, element: HTMLElement): Promise<ReaderSession> {
    const [bookRecord, fileRecord] = await Promise.all([
      this.db.books.get(bookId),
      this.db.epubFiles.get(bookId),
    ])
    if (bookRecord === undefined || fileRecord === undefined) {
      throw new Error(READER_ERROR_MESSAGE)
    }

    let book: Book | null = null
    let rendition: Rendition | null = null
    try {
      book = ePub(await fileRecord.file.arrayBuffer())
      await book.opened
      rendition = book.renderTo(element, {
        width: '100%',
        height: '100%',
        flow: 'paginated',
        spread: 'auto',
      })
      await rendition.display()
    } catch {
      rendition?.destroy()
      book?.destroy()
      throw new Error(READER_ERROR_MESSAGE)
    }

    const openedBook = book
    const openedRendition = rendition
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
      goTo: async (href: string) => openedRendition.display(href),
      destroy: () => {
        openedRendition.destroy()
        openedBook.destroy()
      },
    }
  }
}

export const readerService = new ReaderService()

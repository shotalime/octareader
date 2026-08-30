import ePub from 'epubjs'
import type Book from 'epubjs/types/book'
import type Rendition from 'epubjs/types/rendition'

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
  destroy: () => void
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
      await book.ready
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

    return {
      title: bookRecord.title,
      author: bookRecord.author,
      nextPage: async () => openedRendition.next(),
      previousPage: async () => openedRendition.prev(),
      nextChapter: async () => displayChapter(1),
      previousChapter: async () => displayChapter(-1),
      destroy: () => {
        openedRendition.destroy()
        openedBook.destroy()
      },
    }
  }
}

export const readerService = new ReaderService()

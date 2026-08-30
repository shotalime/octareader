import JSZip from 'jszip'

import { database, type OctaReaderDatabase } from '@/data/database'
import type { Book, EpubFile } from '@/data/models'

export const INVALID_EPUB_MESSAGE =
  'Не удалось открыть книгу. Возможно, файл повреждён или имеет неподдерживаемый формат.'
export const STORAGE_QUOTA_MESSAGE =
  'Недостаточно свободного места для добавления книги. Освободите место на устройстве и попробуйте ещё раз.'

export class BookImportError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid_epub' | 'storage_quota',
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'BookImportError'
  }
}

export type BookImportResult =
  { status: 'imported'; book: Book } | { status: 'duplicate'; book: Book }

type ParsedMetadata = Pick<
  Book,
  'title' | 'author' | 'cover' | 'coverMediaType'
>

const parseXml = (content: string): XMLDocument => {
  const document = new DOMParser().parseFromString(content, 'application/xml')
  if (document.querySelector('parsererror') !== null) {
    throw new Error('Invalid XML')
  }
  return document
}

const elementsByLocalName = (
  document: Document | Element,
  name: string,
): Element[] =>
  Array.from(document.getElementsByTagName('*')).filter(
    (element) => element.localName === name,
  )

const firstText = (document: Document | Element, name: string): string | null =>
  elementsByLocalName(document, name)[0]?.textContent?.trim() || null

const resolveArchivePath = (basePath: string, relativePath: string): string => {
  const baseSegments = basePath.split('/').slice(0, -1)
  for (const segment of relativePath.split('/')) {
    if (segment === '..') {
      baseSegments.pop()
    } else if (segment !== '.' && segment !== '') {
      baseSegments.push(segment)
    }
  }
  return baseSegments.join('/')
}

const assertNoUnsupportedEncryption = async (archive: JSZip): Promise<void> => {
  const encryptionFile = archive.file('META-INF/encryption.xml')
  if (encryptionFile === null) {
    return
  }

  const document = parseXml(await encryptionFile.async('text'))
  const allowedFontAlgorithms = new Set([
    'http://www.idpf.org/2008/embedding',
    'http://ns.adobe.com/pdf/enc#RC',
  ])
  const algorithms = elementsByLocalName(document, 'EncryptionMethod').map(
    (element) => element.getAttribute('Algorithm'),
  )
  if (
    algorithms.length === 0 ||
    algorithms.some(
      (algorithm) =>
        algorithm === null || !allowedFontAlgorithms.has(algorithm),
    )
  ) {
    throw new Error('Unsupported encryption')
  }
}

const parseEpub = async (content: ArrayBuffer): Promise<ParsedMetadata> => {
  const archive = await JSZip.loadAsync(content)
  const mimetype = await archive.file('mimetype')?.async('text')
  if (mimetype?.trim() !== 'application/epub+zip') {
    throw new Error('Invalid EPUB mimetype')
  }

  await assertNoUnsupportedEncryption(archive)
  const containerFile = archive.file('META-INF/container.xml')
  if (containerFile === null) {
    throw new Error('Missing container')
  }
  const container = parseXml(await containerFile.async('text'))
  const packagePath = elementsByLocalName(
    container,
    'rootfile',
  )[0]?.getAttribute('full-path')
  if (packagePath === null || packagePath === undefined) {
    throw new Error('Missing package path')
  }

  const packageFile = archive.file(packagePath)
  if (packageFile === null) {
    throw new Error('Missing package')
  }
  const packageDocument = parseXml(await packageFile.async('text'))
  const fixedLayout = elementsByLocalName(packageDocument, 'meta').some(
    (element) =>
      (element.getAttribute('property') === 'rendition:layout' &&
        element.textContent?.trim() === 'pre-paginated') ||
      (element.getAttribute('name') === 'fixed-layout' &&
        element.getAttribute('content') === 'true'),
  )
  if (fixedLayout) {
    throw new Error('Fixed-layout EPUB is unsupported')
  }

  const title = firstText(packageDocument, 'title')
  if (title === null) {
    throw new Error('Missing title')
  }
  const author = firstText(packageDocument, 'creator')
  const manifestItems = elementsByLocalName(packageDocument, 'item')
  const epub3Cover = manifestItems.find((element) =>
    (element.getAttribute('properties') ?? '')
      .split(/\s+/u)
      .includes('cover-image'),
  )
  const epub2CoverId = elementsByLocalName(packageDocument, 'meta')
    .find((element) => element.getAttribute('name') === 'cover')
    ?.getAttribute('content')
  const coverItem =
    epub3Cover ??
    manifestItems.find((element) => element.getAttribute('id') === epub2CoverId)
  const coverHref = coverItem?.getAttribute('href')
  const coverFile =
    coverHref === null || coverHref === undefined
      ? null
      : archive.file(resolveArchivePath(packagePath, coverHref))
  const coverMediaType = coverItem?.getAttribute('media-type') ?? null
  const cover =
    coverFile === null || coverMediaType === null
      ? null
      : new Blob([await coverFile.async('arraybuffer')], {
          type: coverMediaType,
        })

  return { title, author, cover, coverMediaType }
}

const sha256 = async (content: ArrayBuffer): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', content)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

const isErrorRecord = (
  value: unknown,
): value is {
  name?: unknown
  message?: unknown
  inner?: unknown
  cause?: unknown
} => typeof value === 'object' && value !== null

const isQuotaError = (error: unknown): boolean => {
  if (!isErrorRecord(error)) {
    return false
  }
  if (
    error.name === 'QuotaExceededError' ||
    (typeof error.message === 'string' &&
      error.message.includes('QuotaExceededError'))
  ) {
    return true
  }
  return isQuotaError(error.inner) || isQuotaError(error.cause)
}

export class BookImportService {
  constructor(private readonly db: OctaReaderDatabase = database) {}

  async import(file: Blob, now = Date.now()): Promise<BookImportResult> {
    let content: ArrayBuffer
    let metadata: ParsedMetadata
    let contentHash: string
    try {
      content = await file.arrayBuffer()
      ;[metadata, contentHash] = await Promise.all([
        parseEpub(content),
        sha256(content),
      ])
    } catch (error: unknown) {
      throw new BookImportError(INVALID_EPUB_MESSAGE, 'invalid_epub', {
        cause: error,
      })
    }

    const duplicate = await this.db.books
      .where('contentHash')
      .equals(contentHash)
      .first()
    if (duplicate !== undefined) {
      return { status: 'duplicate', book: duplicate }
    }

    const book: Book = {
      id: crypto.randomUUID(),
      contentHash,
      ...metadata,
      createdAt: now,
      updatedAt: now,
    }
    const epubFile: EpubFile = { bookId: book.id, file }

    try {
      await this.db.transaction(
        'rw',
        this.db.books,
        this.db.epubFiles,
        async () => {
          const concurrentDuplicate = await this.db.books
            .where('contentHash')
            .equals(contentHash)
            .first()
          if (concurrentDuplicate !== undefined) {
            return
          }
          await this.db.books.add(book)
          await this.db.epubFiles.add(epubFile)
        },
      )
    } catch (error: unknown) {
      if (isQuotaError(error)) {
        throw new BookImportError(STORAGE_QUOTA_MESSAGE, 'storage_quota', {
          cause: error,
        })
      }
      if (isErrorRecord(error) && error.name === 'ConstraintError') {
        const concurrentlyStored = await this.db.books
          .where('contentHash')
          .equals(contentHash)
          .first()
        if (concurrentlyStored !== undefined) {
          return { status: 'duplicate', book: concurrentlyStored }
        }
      }
      throw error
    }

    const storedBook = await this.db.books
      .where('contentHash')
      .equals(contentHash)
      .first()
    if (storedBook === undefined) {
      throw new Error('Atomic EPUB import did not persist a book')
    }
    return storedBook.id === book.id
      ? { status: 'imported', book: storedBook }
      : { status: 'duplicate', book: storedBook }
  }
}

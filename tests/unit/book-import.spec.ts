import 'fake-indexeddb/auto'

import Dexie from 'dexie'
import JSZip from 'jszip'
import { afterEach, describe, expect, it } from 'vitest'

import { OctaReaderDatabase } from '@/data/database'
import {
  BookImportService,
  INVALID_EPUB_MESSAGE,
  STORAGE_QUOTA_MESSAGE,
} from '@/domain/book-import'
import type { BookImportError } from '@/domain/book-import'

const databaseNames: string[] = []

afterEach(async () => {
  await Promise.all(databaseNames.splice(0).map((name) => Dexie.delete(name)))
})

const createDatabase = (): OctaReaderDatabase => {
  const name = `import-test-${crypto.randomUUID()}`
  databaseNames.push(name)
  return new OctaReaderDatabase(name)
}

const createEpub = async (options?: {
  title?: string
  fixedLayout?: boolean
  drm?: boolean
  spine?: 'valid' | 'missing' | 'unknown-item' | 'missing-file'
}): Promise<Blob> => {
  const zip = new JSZip()
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file(
    'META-INF/container.xml',
    '<?xml version="1.0"?><container><rootfiles><rootfile full-path="OPS/package.opf"/></rootfiles></container>',
  )
  if (options?.drm === true) {
    zip.file(
      'META-INF/encryption.xml',
      '<encryption><EncryptedData><EncryptionMethod Algorithm="urn:unsupported-drm"/></EncryptedData></encryption>',
    )
  }
  zip.file(
    'OPS/package.opf',
    `<?xml version="1.0"?><package><metadata><title>${options?.title ?? 'Книга'}</title><creator>Автор</creator>${options?.fixedLayout === true ? '<meta property="rendition:layout">pre-paginated</meta>' : ''}</metadata><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest>${options?.spine === 'missing' ? '' : `<spine><itemref idref="${options?.spine === 'unknown-item' ? 'unknown' : 'chapter'}"/></spine>`}</package>`,
  )
  if (options?.spine !== 'missing-file') {
    zip.file('OPS/chapter.xhtml', '<html><body><p>Text</p></body></html>')
  }
  return new Blob([await zip.generateAsync({ type: 'arraybuffer' })], {
    type: 'application/epub+zip',
  })
}

describe('BookImportService', () => {
  it('imports metadata and file atomically', async () => {
    const db = createDatabase()
    const result = await new BookImportService(db).import(
      await createEpub(),
      10,
    )

    expect(result.status).toBe('imported')
    expect(result.book).toMatchObject({ title: 'Книга', author: 'Автор' })
    expect(await db.epubFiles.get(result.book.id)).toBeDefined()
    db.close()
  })

  it('keeps an imported book and its file after reopening the database', async () => {
    const db = createDatabase()
    const result = await new BookImportService(db).import(await createEpub())
    const databaseName = db.name
    db.close()

    const reopenedDb = new OctaReaderDatabase(databaseName)
    expect(await reopenedDb.books.get(result.book.id)).toEqual(result.book)
    expect(await reopenedDb.epubFiles.get(result.book.id)).toMatchObject({
      bookId: result.book.id,
    })
    reopenedDb.close()
  })

  it('returns the existing book for duplicate content', async () => {
    const db = createDatabase()
    const service = new BookImportService(db)
    const file = await createEpub()
    const first = await service.import(file)
    const second = await service.import(file)

    expect(second).toEqual({ status: 'duplicate', book: first.book })
    expect(await db.books.count()).toBe(1)
    db.close()
  })

  it('rejects a damaged archive with a controlled error', async () => {
    const db = createDatabase()

    await expect(
      new BookImportService(db).import(new Blob(['not an epub'])),
    ).rejects.toMatchObject({
      message: INVALID_EPUB_MESSAGE,
      code: 'invalid_epub',
    } satisfies Partial<BookImportError>)
    expect(await db.books.count()).toBe(0)
    db.close()
  })

  it.each(['missing', 'unknown-item', 'missing-file'] as const)(
    'rejects an EPUB with a %s spine',
    async (spine) => {
      const db = createDatabase()

      await expect(
        new BookImportService(db).import(await createEpub({ spine })),
      ).rejects.toMatchObject({
        message: INVALID_EPUB_MESSAGE,
        code: 'invalid_epub',
      } satisfies Partial<BookImportError>)
      expect(await db.books.count()).toBe(0)
      db.close()
    },
  )

  it('rejects a fixed-layout EPUB with a controlled error', async () => {
    const db = createDatabase()

    await expect(
      new BookImportService(db).import(await createEpub({ fixedLayout: true })),
    ).rejects.toMatchObject({
      message: INVALID_EPUB_MESSAGE,
      code: 'invalid_epub',
    } satisfies Partial<BookImportError>)
    expect(await db.books.count()).toBe(0)
    db.close()
  })

  it('rejects a DRM-protected EPUB with a controlled error', async () => {
    const db = createDatabase()

    await expect(
      new BookImportService(db).import(await createEpub({ drm: true })),
    ).rejects.toMatchObject({
      message: INVALID_EPUB_MESSAGE,
      code: 'invalid_epub',
    } satisfies Partial<BookImportError>)
    expect(await db.books.count()).toBe(0)
    db.close()
  })

  it('rejects XHTML encrypted with a font-obfuscation algorithm', async () => {
    const epub = await createEpub()
    const zip = await JSZip.loadAsync(await epub.arrayBuffer())
    zip.file(
      'META-INF/encryption.xml',
      '<encryption><EncryptedData><EncryptionMethod Algorithm="http://www.idpf.org/2008/embedding"/><CipherData><CipherReference URI="OPS/chapter.xhtml"/></CipherData></EncryptedData></encryption>',
    )
    const db = createDatabase()

    await expect(
      new BookImportService(db).import(
        new Blob([await zip.generateAsync({ type: 'arraybuffer' })]),
      ),
    ).rejects.toMatchObject({
      message: INVALID_EPUB_MESSAGE,
      code: 'invalid_epub',
    } satisfies Partial<BookImportError>)
    expect(await db.books.count()).toBe(0)
    db.close()
  })

  it('rolls back the book when storing the EPUB exceeds quota', async () => {
    const db = createDatabase()
    await db.open()
    db.epubFiles.hook('creating', () => {
      throw new DOMException('Storage full', 'QuotaExceededError')
    })

    await expect(
      new BookImportService(db).import(await createEpub()),
    ).rejects.toMatchObject({
      message: STORAGE_QUOTA_MESSAGE,
      code: 'storage_quota',
    } satisfies Partial<BookImportError>)
    expect(await db.books.count()).toBe(0)
    expect(await db.epubFiles.count()).toBe(0)
    db.close()
  })
})

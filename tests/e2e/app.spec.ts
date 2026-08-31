import { expect, test } from '@playwright/test'
import JSZip from 'jszip'

const createEpub = async (): Promise<Buffer> => {
  const zip = new JSZip()
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file(
    'META-INF/container.xml',
    '<container><rootfiles><rootfile full-path="OPS/package.opf"/></rootfiles></container>',
  )
  zip.file(
    'OPS/package.opf',
    '<package><metadata><title>Книга после перезагрузки</title><creator>Автор</creator></metadata><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="chapter"/></spine></package>',
  )
  zip.file('OPS/chapter.xhtml', '<html><body><p>Text</p></body></html>')
  return zip.generateAsync({ type: 'nodebuffer' })
}

const directRoutes = [
  { path: '/', heading: 'Книги' },
  { path: '/reader', heading: 'Страница не найдена' },
  { path: '/vocabulary', heading: 'Слова' },
  { path: '/review', heading: 'Повторение' },
  { path: '/settings', heading: 'Настройки' },
  { path: '/does-not-exist', heading: 'Страница не найдена' },
]

for (const route of directRoutes) {
  test(`маршрут ${route.path} открывается напрямую`, async ({ page }) => {
    await page.goto(route.path)

    await expect(
      page.getByRole('heading', { level: 1, name: route.heading }),
    ).toBeVisible()
  })
}

test('desktop-навигация открывает разделы', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')

  const navigation = page.getByRole('navigation', {
    name: 'Основная навигация',
  })
  await navigation.getByRole('link', { name: 'Словарь' }).click()

  await expect(page).toHaveURL(/\/vocabulary$/)
  await expect(
    page.getByRole('heading', { level: 1, name: 'Слова' }),
  ).toBeVisible()
})

test('мобильная навигация остаётся доступной', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  const navigation = page.getByRole('navigation', {
    name: 'Мобильная навигация',
  })
  await expect(navigation).toBeVisible()
  await navigation.getByRole('link', { name: 'Настройки' }).click()

  await expect(page).toHaveURL(/\/settings$/)
  await expect(
    page.getByRole('heading', { level: 1, name: 'Настройки' }),
  ).toBeVisible()
})

test('manifest содержит данные для установки', async ({ page }) => {
  await page.goto('/')

  const manifestHref = await page
    .locator('link[rel="manifest"]')
    .getAttribute('href')
  expect(manifestHref).toBe('/manifest.webmanifest')

  const response = await page.request.get('/manifest.webmanifest')
  expect(response.ok()).toBe(true)

  const manifest = await response.text()
  expect(manifest).toContain('OctaReader')
  expect(manifest).toContain('standalone')
  expect(manifest).toContain('maskable-icon-512x512.png')
})

test('импортированная книга и EPUB остаются после перезагрузки', async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName === 'webkit',
    'Playwright WebKit disables crypto.subtle on the HTTP preview origin',
  )
  const epub = await createEpub()
  await page.goto('/')
  await page.getByTestId('epub-input').setInputFiles({
    name: 'reload.epub',
    mimeType: 'application/epub+zip',
    buffer: epub,
  })

  await expect(page.getByText('Книга после перезагрузки')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Книга после перезагрузки')).toBeVisible()
  const storedFile = await page.evaluate(async () => {
    const request = indexedDB.open('octareader')
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () =>
        reject(request.error ?? new Error('Failed to open IndexedDB'))
    })
    const file = await new Promise<Blob | undefined>((resolve, reject) => {
      const fileRequest = db.transaction('epubFiles').objectStore('epubFiles')
        .getAll() as IDBRequest<unknown[]>
      fileRequest.onsuccess = () => {
        const record = fileRequest.result[0]
        resolve(
          typeof record === 'object' &&
            record !== null &&
            'file' in record &&
            record.file instanceof Blob
            ? record.file
            : undefined,
        )
      }
      fileRequest.onerror = () =>
        reject(fileRequest.error ?? new Error('Failed to read stored EPUB'))
    })
    db.close()
    return file === undefined
      ? null
      : { size: file.size, type: file.type }
  })
  expect(storedFile).toEqual({
    size: epub.byteLength,
    type: 'application/epub+zip',
  })
})

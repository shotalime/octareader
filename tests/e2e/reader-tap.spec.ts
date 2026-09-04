import { expect, test } from '@playwright/test'
import JSZip from 'jszip'

const createEpub = async (): Promise<Buffer> => {
  const zip = new JSZip()
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file(
    'META-INF/container.xml',
    '<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OPS/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
  )
  zip.file(
    'OPS/package.opf',
    '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">tap-test</dc:identifier><dc:title>Tap test</dc:title><dc:language>en</dc:language></metadata><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="chapter"/></spine></package>',
  )
  zip.file(
    'OPS/chapter.xhtml',
    '<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter</title></head><body><p>Earlier sentence. The mother-in-law arrived!</p></body></html>',
  )
  return zip.generateAsync({ type: 'nodebuffer' })
}

test('tap inside the EPUB document detects a word and sentence', async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName === 'webkit',
    'Playwright WebKit fails to persist the EPUB Blob in IndexedDB on the HTTP preview origin',
  )
  await page.addInitScript(() => {
    if (globalThis.crypto.subtle === undefined) {
      Object.defineProperty(globalThis.crypto, 'subtle', {
        configurable: true,
        value: {
          digest: () => Promise.resolve(new Uint8Array(32).buffer),
        },
      })
    }
  })
  const epub = await createEpub()
  await page.goto('/')
  await expect(page.getByText('Библиотека пока пуста')).toBeVisible()
  await page.getByTestId('epub-input').setInputFiles({
    name: 'tap-test.epub',
    mimeType: 'application/epub+zip',
    buffer: epub,
  })
  await expect(page.getByText('Tap test')).toBeVisible()
  await page.getByRole('link', { name: 'Открыть' }).click()
  await expect(
    page.getByRole('navigation', { name: 'Основная навигация' }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('navigation', { name: 'Мобильная навигация' }),
  ).toHaveCount(0)
  const readerControls = page.getByRole('navigation', {
    name: 'Управление чтением',
  })
  await expect(readerControls).toBeVisible()
  await expect(
    readerControls.getByRole('link', { name: 'Вернуться в библиотеку' }),
  ).toBeVisible()
  await expect(
    readerControls.getByRole('button', { name: 'Открыть оглавление' }),
  ).toBeVisible()
  await expect(
    readerControls.getByRole('button', { name: 'Предыдущая страница' }),
  ).toBeVisible()
  await expect(
    readerControls.getByRole('button', { name: 'Следующая страница' }),
  ).toBeVisible()
  const iframe = page.locator('[data-testid="reader-viewport"] iframe')
  await expect(iframe).toBeVisible()
  const readerFrame = page.frames().find((frame) => frame !== page.mainFrame())
  if (readerFrame === undefined) throw new Error('EPUB iframe was not created')

  await readerFrame.evaluate(() => {
    const paragraph = document.querySelector('p')
    const node = paragraph?.firstChild
    if (!(node instanceof Text) || paragraph === null) {
      throw new Error('EPUB paragraph was not rendered')
    }
    const start = node.data.indexOf('mother-in-law')
    const range = document.createRange()
    range.setStart(node, start + 2)
    range.setEnd(node, start + 3)
    const rect = range.getBoundingClientRect()
    const eventOptions = {
      bubbles: true,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    }
    if ('PointerEvent' in window) {
      paragraph.dispatchEvent(new PointerEvent('pointerdown', eventOptions))
      paragraph.dispatchEvent(new PointerEvent('pointerup', eventOptions))
    } else {
      paragraph.dispatchEvent(new MouseEvent('click', eventOptions))
    }
  })

  await expect(page.getByText('mother-in-law', { exact: true })).toBeVisible()
  await expect(
    page.getByText('The mother-in-law arrived!', { exact: true }),
  ).toBeVisible()

  const dialog = page.getByTestId('translation-dialog')
  const drawerHandle = page.getByTestId('translation-drawer-handle')
  await expect(dialog).toBeVisible()
  await expect(drawerHandle).toBeHidden()

  await page.setViewportSize({ width: 390, height: 844 })

  await expect(drawerHandle).toBeVisible()
  await expect(dialog).toHaveCSS('bottom', '0px')

  await page.setViewportSize({ width: 1280, height: 720 })

  await expect(drawerHandle).toBeHidden()
  const desktopDialogBox = await dialog.boundingBox()
  if (desktopDialogBox === null) throw new Error('Dialog was not rendered')
  expect(desktopDialogBox.y).toBeGreaterThanOrEqual(20)
  expect(desktopDialogBox.y + desktopDialogBox.height).toBeLessThanOrEqual(700)

  const backdrop = page.getByTestId('translation-backdrop')
  const backdropBox = await backdrop.boundingBox()
  if (backdropBox === null) throw new Error('Dialog backdrop was not rendered')
  await page.mouse.move(backdropBox.x + 5, backdropBox.y + 5)
  await page.mouse.down()

  await expect(page.getByRole('dialog')).toBeVisible()

  await page.mouse.up()

  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByTestId('translation-backdrop')).toHaveCount(0)

  const resizedReaderFrame = page.frames().find((frame) => frame !== page.mainFrame())
  if (resizedReaderFrame === undefined) {
    throw new Error('EPUB iframe was not recreated after resizing')
  }
  await resizedReaderFrame.evaluate(() => {
    const paragraph = document.querySelector('p')
    const node = paragraph?.firstChild
    if (!(node instanceof Text) || paragraph === null) {
      throw new Error('EPUB paragraph was not rendered')
    }
    const range = document.createRange()
    range.setStart(node, 2)
    range.setEnd(node, 3)
    const rect = range.getBoundingClientRect()
    paragraph.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
      }),
    )
  })
  await page.waitForTimeout(100)

  await expect(page.getByRole('dialog')).toHaveCount(0)
})

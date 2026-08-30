import { expect, test, type Page } from '@playwright/test'

const putRecords = async (
  page: Page,
  records: Record<string, unknown[]>,
): Promise<void> => {
  await page.evaluate(async (recordsToPut) => {
    const request = indexedDB.open('octareader')
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () =>
        reject(request.error ?? new Error('Не удалось открыть IndexedDB'))
    })
    const stores = Object.keys(recordsToPut)
    const transaction = db.transaction(stores, 'readwrite')
    for (const storeName of stores) {
      const store = transaction.objectStore(storeName)
      for (const record of recordsToPut[storeName] ?? []) store.put(record)
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () =>
        reject(transaction.error ?? new Error('Не удалось записать данные'))
      transaction.onabort = () =>
        reject(transaction.error ?? new Error('Транзакция отменена'))
    })
    db.close()
  }, records)
}

const countRecords = async (page: Page, storeNames: string[]) =>
  page.evaluate(async (names) => {
    const request = indexedDB.open('octareader')
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () =>
        reject(request.error ?? new Error('Не удалось открыть IndexedDB'))
    })
    const counts: Record<string, number> = {}
    await Promise.all(
      names.map(
        (name) =>
          new Promise<void>((resolve, reject) => {
            const countRequest = db.transaction(name).objectStore(name).count()
            countRequest.onsuccess = () => {
              counts[name] = countRequest.result
              resolve()
            }
            countRequest.onerror = () =>
              reject(
                countRequest.error ?? new Error('Не удалось прочитать данные'),
              )
          }),
      ),
    )
    db.close()
    return counts
  }, storeNames)

test('локальные данные проходят основной MVP-сценарий', async ({ page }) => {
  const now = Date.now()
  await page.goto('/')
  await expect(page.getByText('Библиотека пока пуста')).toBeVisible()
  await putRecords(page, {
    books: [
      {
        id: 'acceptance-book',
        contentHash: 'acceptance-hash',
        title: 'Acceptance Book',
        author: 'Test Author',
        cover: null,
        coverMediaType: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    readingProgress: [
      {
        bookId: 'acceptance-book',
        cfi: 'epubcfi(/6/2!/4/2/1:0)',
        percentage: 42,
        updatedAt: now,
      },
    ],
    settings: [
      {
        key: 'gemini-api-key',
        value: {
          apiKey: 'acceptance-credential',
          validationStatus: 'valid',
          validatedAt: now,
        },
        updatedAt: now,
      },
    ],
    translationCache: [
      {
        key: 'acceptance-cache',
        normalizedSourceText: 'reader',
        normalizedSentence: 'the reader learns.',
        sourceLanguage: 'en',
        targetLanguage: 'ru',
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        result: {
          schemaVersion: 1,
          status: 'translated',
          sourceText: 'reader',
          lemma: 'reader',
          partOfSpeech: 'noun',
          translation: 'читатель',
        },
        createdAt: now,
      },
    ],
    vocabularyEntries: [
      {
        id: 'entry-1',
        identityKey: 'reader|noun|en|ru',
        lemma: 'reader',
        partOfSpeech: 'noun',
        sourceLanguage: 'en',
        targetLanguage: 'ru',
        createdAt: now,
        updatedAt: now,
      },
    ],
    vocabularyContexts: [
      {
        id: 'context-1',
        vocabularyEntryId: 'entry-1',
        sourceText: 'reader',
        translation: 'читатель',
        sentence: 'The reader learns.',
        bookId: 'acceptance-book',
        bookTitle: 'Acceptance Book',
        cfi: 'epubcfi(/6/2!/4/2/1:0)',
        createdAt: now,
      },
    ],
    reviewSchedules: [
      {
        vocabularyEntryId: 'entry-1',
        intervalDays: 0,
        dueAt: now - 1,
        lastReviewedAt: null,
        reviewCount: 0,
        lapseCount: 0,
      },
    ],
  })

  await page.reload()
  await expect(page.getByText('Acceptance Book')).toBeVisible()
  await expect(page.getByText('42%')).toBeVisible()

  await page.goto('/vocabulary')
  await expect(page.getByText('reader', { exact: true })).toBeVisible()
  await expect(page.getByText(/The reader learns/)).toBeVisible()

  await page.goto('/review')
  await expect(page.getByText('The _____ learns.')).toBeVisible()
  await page.getByRole('button', { name: 'Показать ответ' }).click()
  await expect(page.getByText('читатель', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Помню', exact: true }).click()
  await expect(page.getByText('Карточек на сегодня нет')).toBeVisible()

  await page.goto('/settings')
  await page.getByRole('button', { name: 'Удалить ключ' }).click()
  await expect(page.getByText('API key не сохранён.')).toBeVisible()
  expect(
    await countRecords(page, ['settings', 'translationCache']),
  ).toEqual({ settings: 0, translationCache: 1 })

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Удалить все данные' }).click()
  await expect(page.getByText('Все локальные данные удалены.')).toBeVisible()
  const storeNames = [
    'books',
    'epubFiles',
    'locations',
    'readingProgress',
    'settings',
    'bookSettings',
    'translationCache',
    'vocabularyEntries',
    'vocabularyContexts',
    'reviewSchedules',
    'reviewEvents',
  ]
  expect(await countRecords(page, storeNames)).toEqual(
    Object.fromEntries(storeNames.map((name) => [name, 0])),
  )
  await page.goto('/')
  await expect(page.getByText('Библиотека пока пуста')).toBeVisible()
})

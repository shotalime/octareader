import { expect, test } from '@playwright/test'

const directRoutes = [
  { path: '/', heading: 'Книги' },
  { path: '/reader', heading: 'Читалка' },
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

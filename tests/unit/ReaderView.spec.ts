import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ReaderView from '@/views/ReaderView.vue'

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  nextPage: vi.fn(),
  previousPage: vi.fn(),
  nextChapter: vi.fn(),
  previousChapter: vi.fn(),
  destroy: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { bookId: 'book-1' } }),
}))
vi.mock('@/domain/reader', () => ({
  READER_ERROR_MESSAGE:
    'Не удалось открыть книгу. Возможно, файл повреждён или имеет неподдерживаемый формат.',
  readerService: { open: mocks.open },
}))

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset())
  mocks.open.mockResolvedValue({
    title: 'Тестовая книга',
    author: 'Автор',
    nextPage: mocks.nextPage,
    previousPage: mocks.previousPage,
    nextChapter: mocks.nextChapter,
    previousChapter: mocks.previousChapter,
    destroy: mocks.destroy,
  })
})

describe('ReaderView', () => {
  it('открывает локальную книгу и управляет страницами и главами', async () => {
    const wrapper = mount(ReaderView)
    await flushPromises()
    expect(mocks.open).toHaveBeenCalledWith(
      'book-1',
      wrapper.get('[data-testid="reader-viewport"]').element,
    )
    expect(wrapper.text()).toContain('Тестовая книга')
    await wrapper.get('button[aria-label="Следующая глава"]').trigger('click')
    await wrapper.findAll('button').at(-1)?.trigger('click')
    expect(mocks.nextChapter).toHaveBeenCalledOnce()
    expect(mocks.nextPage).toHaveBeenCalledOnce()
    wrapper.unmount()
    expect(mocks.destroy).toHaveBeenCalledOnce()
  })

  it('показывает контролируемую ошибку рендеринга', async () => {
    mocks.open.mockRejectedValue(new Error('broken'))
    const wrapper = mount(ReaderView)
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain(
      'Не удалось открыть книгу',
    )
  })
})

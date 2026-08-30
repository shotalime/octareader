import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LibraryBook } from '@/domain/library'
import LibraryView from '@/views/LibraryView.vue'

const mocks = vi.hoisted(() => ({
  listBooks: vi.fn(),
  importBook: vi.fn(),
  deleteBook: vi.fn(),
}))
vi.mock('@/domain/library', () => ({ libraryService: mocks }))

const book: LibraryBook = {
  id: 'book-1',
  contentHash: 'hash',
  title: 'Гордость и предубеждение',
  author: 'Джейн Остин',
  cover: null,
  coverMediaType: null,
  createdAt: 1,
  updatedAt: 1,
  progressPercentage: 42,
}

beforeEach(() => {
  mocks.listBooks.mockReset().mockResolvedValue([])
  mocks.importBook.mockReset()
  mocks.deleteBook.mockReset().mockResolvedValue(undefined)
})

const mountLibrary = () =>
  mount(LibraryView, {
    global: { stubs: { RouterLink: RouterLinkStub } },
  })

describe('LibraryView', () => {
  it('показывает русскоязычное пустое состояние', async () => {
    const wrapper = mountLibrary()
    await flushPromises()
    expect(wrapper.get('h1').text()).toBe('Книги')
    expect(wrapper.text()).toContain('Библиотека пока пуста')
    expect(wrapper.get('button').attributes('disabled')).toBeUndefined()
  })

  it('показывает сохранённые книги и прогресс', async () => {
    mocks.listBooks.mockResolvedValue([book])
    const wrapper = mountLibrary()
    await flushPromises()
    expect(wrapper.text()).toContain(book.title)
    expect(wrapper.text()).toContain(book.author)
    expect(wrapper.text()).toContain('42%')
    expect(wrapper.getComponent(RouterLinkStub).props('to')).toBe(
      `/reader/${book.id}`,
    )
  })

  it('предлагает открыть уже добавленную книгу', async () => {
    mocks.importBook.mockResolvedValue({ status: 'duplicate', book })
    const wrapper = mountLibrary()
    await flushPromises()
    const input = wrapper.get('[data-testid="epub-input"]')
    Object.defineProperty(input.element, 'files', {
      value: [new File(['epub'], 'book.epub')],
    })
    await input.trigger('change')
    await flushPromises()
    expect(wrapper.text()).toContain('Эта книга уже добавлена')
    expect(wrapper.getComponent(RouterLinkStub).text()).toBe('Открыть книгу')
  })

  it('удаляет книгу только после подтверждения', async () => {
    mocks.listBooks.mockResolvedValue([book])
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const wrapper = mountLibrary()
    await flushPromises()
    await wrapper
      .get(`[aria-label="Удалить книгу «${book.title}»"]`)
      .trigger('click')
    await flushPromises()
    expect(mocks.deleteBook).toHaveBeenCalledWith(book.id)
  })
})

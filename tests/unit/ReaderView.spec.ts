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
  goTo: vi.fn(),
  translate: vi.fn(),
  saveBookLanguages: vi.fn(),
  saveVocabulary: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { bookId: 'book-1' } }),
}))
vi.mock('@/domain/reader', () => ({
  READER_ERROR_MESSAGE:
    'Не удалось открыть книгу. Возможно, файл повреждён или имеет неподдерживаемый формат.',
  readerService: { open: mocks.open },
}))
vi.mock('@/domain/settings', () => ({
  settingsRepository: { saveBookLanguages: mocks.saveBookLanguages },
}))
vi.mock('@/domain/translation', () => ({
  translationService: { translate: mocks.translate },
}))
vi.mock('@/domain/vocabulary', () => ({
  vocabularyService: { save: mocks.saveVocabulary },
}))

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset())
  mocks.open.mockResolvedValue({
    title: 'Тестовая книга',
    author: 'Автор',
    bookLanguages: {
      bookId: 'book-1',
      sourceLanguage: 'en',
      targetLanguage: 'ru',
      updatedAt: 1,
    },
    suggestedSourceLanguage: 'en',
    nextPage: mocks.nextPage,
    previousPage: mocks.previousPage,
    nextChapter: mocks.nextChapter,
    previousChapter: mocks.previousChapter,
    destroy: mocks.destroy,
    appearance: {
      fontSizePercent: 100,
      fontFamily: 'serif',
      lineHeight: 1.6,
      marginPercent: 8,
      theme: 'light',
    },
    tableOfContents: [
      {
        id: 'chapter-1',
        href: 'chapter-1.xhtml',
        label: 'Глава 1',
        children: [],
      },
    ],
    goTo: mocks.goTo,
  })
  mocks.translate.mockResolvedValue({
    result: {
      schemaVersion: 1,
      status: 'translated',
      sourceText: 'running',
      lemma: 'run',
      partOfSpeech: 'verb',
      translation: 'бежит',
    },
    fromCache: false,
  })
  mocks.saveBookLanguages.mockResolvedValue(undefined)
  mocks.saveVocabulary.mockResolvedValue(undefined)
})

describe('ReaderView', () => {
  it('открывает оглавление и переходит к выбранной главе', async () => {
    const wrapper = mount(ReaderView)
    await flushPromises()
    await wrapper.get('button[aria-controls="reader-toc"]').trigger('click')
    expect(wrapper.text()).toContain('Глава 1')
    await wrapper.get('#reader-toc li button').trigger('click')
    expect(mocks.goTo).toHaveBeenCalledWith('chapter-1.xhtml')
    expect(wrapper.find('#reader-toc').exists()).toBe(false)
  })

  it('не мешает чтению книги без оглавления', async () => {
    mocks.open.mockResolvedValue({
      title: 'Без оглавления',
      author: null,
      bookLanguages: null,
      suggestedSourceLanguage: 'en',
      nextPage: mocks.nextPage,
      previousPage: mocks.previousPage,
      nextChapter: mocks.nextChapter,
      previousChapter: mocks.previousChapter,
      destroy: mocks.destroy,
      appearance: {
        fontSizePercent: 100,
        fontFamily: 'serif',
        lineHeight: 1.6,
        marginPercent: 8,
        theme: 'light',
      },
      tableOfContents: [],
      goTo: mocks.goTo,
    })
    const wrapper = mount(ReaderView)
    await flushPromises()
    await wrapper.get('button[aria-controls="reader-toc"]').trigger('click')
    expect(wrapper.text()).toContain('оглавление отсутствует')
    expect(wrapper.find('[data-testid="reader-viewport"]').exists()).toBe(true)
  })
  it('открывает локальную книгу и управляет страницами и главами', async () => {
    const wrapper = mount(ReaderView)
    await flushPromises()
    expect(mocks.open).toHaveBeenCalledWith(
      'book-1',
      wrapper.get('[data-testid="reader-viewport"]').element,
      expect.any(Function),
      expect.any(Function),
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

  it('переводит слово из EPUB и показывает контекстный результат', async () => {
    const wrapper = mount(ReaderView)
    await flushPromises()
    const onTextTap = mocks.open.mock.calls[0]?.[3] as
      | ((selection: { word: string; sentence: string | null }) => void)
      | undefined
    onTextTap?.({ word: 'running', sentence: 'She is running home.' })
    await flushPromises()

    expect(mocks.translate).toHaveBeenCalledWith({
      sourceText: 'running',
      sentence: 'She is running home.',
      sourceLanguage: 'en',
      targetLanguage: 'ru',
    })
    expect(wrapper.text()).toContain('бежит')
    expect(wrapper.text()).toContain('run')
    expect(wrapper.text()).toContain('глагол')
    expect(wrapper.text()).toContain('She is running home.')
  })

  it('просит выбрать языки книги перед первым переводом', async () => {
    mocks.open.mockResolvedValue({
      ...(await mocks.open()),
      bookLanguages: null,
      suggestedSourceLanguage: 'de',
    })
    mocks.open.mockClear()
    const wrapper = mount(ReaderView)
    await flushPromises()
    const onTextTap = mocks.open.mock.calls[0]?.[3] as
      | ((selection: { word: string; sentence: string | null }) => void)
      | undefined
    onTextTap?.({ word: 'läuft', sentence: null })
    await flushPromises()
    expect(wrapper.text()).toContain('Укажите направление перевода')
    expect(mocks.translate).not.toHaveBeenCalled()

    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Сохранить и перевести'))
      ?.trigger('click')
    await flushPromises()
    expect(mocks.saveBookLanguages).toHaveBeenCalledWith('book-1', 'de', 'ru')
    expect(mocks.translate).toHaveBeenCalledOnce()
  })

  it('сохраняет переведённое слово с книгой и текущим CFI', async () => {
    const wrapper = mount(ReaderView)
    await flushPromises()
    const onState = mocks.open.mock.calls[0]?.[2] as (state: object) => void
    const onTextTap = mocks.open.mock.calls[0]?.[3] as (selection: {
      word: string
      sentence: string | null
    }) => void
    onState({
      cfi: 'epubcfi(/6/2)',
      progressPercentage: 10,
      isProgressCalculating: false,
    })
    onTextTap({ word: 'running', sentence: 'She is running home.' })
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Сохранить слово'))
      ?.trigger('click')
    await flushPromises()
    expect(mocks.saveVocabulary).toHaveBeenCalledWith(
      expect.objectContaining({
        lemma: 'run',
        bookId: 'book-1',
        bookTitle: 'Тестовая книга',
        cfi: 'epubcfi(/6/2)',
      }),
    )
    expect(wrapper.text()).toContain('Сохранено')
  })

  it('показывает санитизированную ошибку и выполняет только ручной повтор', async () => {
    mocks.translate
      .mockRejectedValueOnce(new Error('provider response with secret details'))
      .mockResolvedValueOnce({
        result: {
          schemaVersion: 1,
          status: 'proper_noun',
          sourceText: 'London',
          lemma: 'London',
          partOfSpeech: 'noun',
          translation: null,
        },
        fromCache: false,
      })
    const wrapper = mount(ReaderView)
    await flushPromises()
    const onTextTap = mocks.open.mock.calls[0]?.[3] as
      | ((selection: { word: string; sentence: string | null }) => void)
      | undefined
    onTextTap?.({ word: 'London', sentence: 'London is large.' })
    await flushPromises()
    expect(wrapper.text()).toContain('Не удалось получить перевод')
    expect(wrapper.text()).not.toContain('secret details')
    expect(mocks.translate).toHaveBeenCalledOnce()

    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Повторить'))
      ?.trigger('click')
    await flushPromises()
    expect(mocks.translate).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Имя собственное — перевод не требуется')
  })
})

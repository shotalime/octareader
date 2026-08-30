import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import VocabularyView from '@/views/VocabularyView.vue'

const mocks = vi.hoisted(() => ({ list: vi.fn(), delete: vi.fn() }))
vi.mock('@/domain/vocabulary', () => ({
  vocabularyService: { list: mocks.list, delete: mocks.delete },
}))

const entry = {
  id: 'entry-1',
  identityKey: 'identity',
  lemma: 'run',
  partOfSpeech: 'verb',
  sourceLanguage: 'en',
  targetLanguage: 'ru',
  createdAt: 1,
  updatedAt: 2,
  contexts: [
    {
      id: 'context-1',
      vocabularyEntryId: 'entry-1',
      sourceText: 'running',
      translation: 'бежит',
      sentence: 'She is running home.',
      bookId: 'book-1',
      bookTitle: 'Test book',
      cfi: null,
      createdAt: 2,
    },
  ],
}

beforeEach(() => {
  mocks.list.mockReset().mockResolvedValue([entry])
  mocks.delete.mockReset().mockResolvedValue(undefined)
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

describe('VocabularyView', () => {
  it('shows lemmas, parts of speech, translations and sentences', async () => {
    const wrapper = mount(VocabularyView)
    await flushPromises()
    expect(wrapper.text()).toContain('run')
    expect(wrapper.text()).toContain('глагол')
    expect(wrapper.text()).toContain('running — бежит')
    expect(wrapper.text()).toContain('She is running home.')
  })

  it('shows an empty state', async () => {
    mocks.list.mockResolvedValue([])
    const wrapper = mount(VocabularyView)
    await flushPromises()
    expect(wrapper.text()).toContain('Слов пока нет')
  })

  it('deletes only the selected entry after confirmation', async () => {
    const second = { ...entry, id: 'entry-2', lemma: 'walk', contexts: [] }
    mocks.list.mockResolvedValue([entry, second])
    const wrapper = mount(VocabularyView)
    await flushPromises()
    await wrapper.get('button[aria-label="Удалить run"]').trigger('click')
    await flushPromises()
    expect(mocks.delete).toHaveBeenCalledWith('entry-1')
    expect(wrapper.text()).not.toContain('running — бежит')
    expect(wrapper.text()).toContain('walk')
  })
})

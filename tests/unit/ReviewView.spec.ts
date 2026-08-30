import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ReviewView from '@/views/ReviewView.vue'

const mocks = vi.hoisted(() => ({ due: vi.fn(), rate: vi.fn() }))
vi.mock('@/domain/review', () => ({
  reviewService: { due: mocks.due, rate: mocks.rate },
  sentenceWithBlank: (context: {
    sentence: string | null
    sourceText: string
  }) => context.sentence?.replace(context.sourceText, '_____') ?? null,
}))

const card = {
  entry: {
    id: 'run',
    identityKey: 'run',
    lemma: 'run',
    partOfSpeech: 'verb',
    sourceLanguage: 'en',
    targetLanguage: 'ru',
    createdAt: 1,
    updatedAt: 1,
  },
  context: {
    id: 'context',
    vocabularyEntryId: 'run',
    sourceText: 'running',
    translation: 'бежит',
    sentence: 'She is running home.',
    bookId: 'book',
    bookTitle: 'Book',
    cfi: null,
    createdAt: 1,
  },
  schedule: {
    vocabularyEntryId: 'run',
    intervalDays: 0,
    dueAt: 1,
    lastReviewedAt: null,
    reviewCount: 0,
    lapseCount: 0,
  },
}

beforeEach(() => {
  mocks.due.mockReset().mockResolvedValue([card])
  mocks.rate.mockReset().mockResolvedValue(undefined)
})

describe('ReviewView', () => {
  it('reveals a contextual answer and removes a rated card from the session', async () => {
    const wrapper = mount(ReviewView)
    await flushPromises()
    expect(wrapper.text()).toContain('She is _____ home.')
    expect(wrapper.text()).not.toContain('бежит')
    await wrapper.get('button').trigger('click')
    expect(wrapper.text()).toContain('бежит')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Помню')
      ?.trigger('click')
    await flushPromises()
    expect(mocks.rate).toHaveBeenCalledWith('run', 'good')
    expect(wrapper.text()).toContain('Карточек на сегодня нет')
  })

  it('falls back to the lemma without a context', async () => {
    mocks.due.mockResolvedValue([
      { ...card, context: { ...card.context, sentence: null } },
    ])
    const wrapper = mount(ReviewView)
    await flushPromises()
    expect(wrapper.text()).toContain('Вспомните перевод слова')
    expect(wrapper.text()).toContain('run')
  })
})

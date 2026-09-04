import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import TranslationPopup from '@/components/TranslationPopup.vue'

const mountPopup = () =>
  mount(TranslationPopup, {
    props: {
      selection: { word: 'word', sentence: null, cfi: 'epubcfi(/6/2)' },
      status: 'needs-languages',
      result: null,
      errorMessage: null,
      fromCache: false,
      isSaving: false,
      isSaved: false,
      sourceLanguage: 'en',
      targetLanguage: 'ru',
    },
  })

describe('TranslationPopup language selectors', () => {
  it('renders a mobile bottom drawer and a centered desktop popup', () => {
    const wrapper = mountPopup()
    const dialog = wrapper.get('[data-testid="translation-dialog"]')

    expect(dialog.classes()).toEqual(
      expect.arrayContaining([
        'inset-x-0',
        'bottom-0',
        'rounded-t-3xl',
        'sm:left-1/2',
        'sm:top-1/2',
        'sm:-translate-x-1/2',
        'sm:-translate-y-1/2',
      ]),
    )
    expect(
      wrapper.find('[data-testid="translation-drawer-handle"]').classes(),
    ).toContain('sm:hidden')
    expect(wrapper.get('button[aria-label="Закрыть перевод"]').classes()).toEqual(
      expect.arrayContaining(['hidden', 'sm:inline-flex']),
    )
  })

  it('searches and selects a source language outside the former short list', async () => {
    const wrapper = mountPopup()
    await wrapper.get('input[aria-label="Поиск языка книги"]').setValue('he')
    const select = wrapper.get('select[aria-label="Язык книги"]')

    expect(
      select.findAll('option').map((option) => option.attributes('value')),
    ).toEqual(['en', 'he'])
    await select.setValue('he')
    expect(wrapper.emitted('update:sourceLanguage')?.at(-1)).toEqual(['he'])
  })

  it('searches and selects a target language script variant', async () => {
    const wrapper = mountPopup()
    await wrapper
      .get('input[aria-label="Поиск языка перевода"]')
      .setValue('zh-Hant')
    const select = wrapper.get('select[aria-label="Переводить на"]')

    expect(
      select.findAll('option').map((option) => option.attributes('value')),
    ).toEqual(['ru', 'zh-Hant'])
    await select.setValue('zh-Hant')
    expect(wrapper.emitted('update:targetLanguage')?.at(-1)).toEqual([
      'zh-Hant',
    ])
  })
})

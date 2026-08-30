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

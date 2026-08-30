import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SettingsView from '@/views/SettingsView.vue'

const mocks = vi.hoisted(() => ({
  getReaderAppearance: vi.fn(),
  saveReaderAppearance: vi.fn(),
  getKeyState: vi.fn(),
  saveKey: vi.fn(),
  validateKey: vi.fn(),
  deleteKey: vi.fn(),
  clearAll: vi.fn(),
}))

vi.mock('@/domain/api-key', () => ({
  aiErrorMessage: () => 'Санитизированная ошибка',
  apiKeyService: {
    getState: mocks.getKeyState,
    save: mocks.saveKey,
    validate: mocks.validateKey,
    delete: mocks.deleteKey,
  },
}))

vi.mock('@/domain/settings', () => ({
  DEFAULT_READER_APPEARANCE: {
    fontSizePercent: 100,
    fontFamily: 'serif',
    lineHeight: 1.6,
    marginPercent: 8,
    theme: 'light',
  },
  settingsRepository: mocks,
}))

vi.mock('@/domain/local-data', () => ({
  localDataService: { clearAll: mocks.clearAll },
}))

beforeEach(() => {
  mocks.getReaderAppearance.mockReset().mockResolvedValue({
    fontSizePercent: 120,
    fontFamily: 'sans-serif',
    lineHeight: 1.8,
    marginPercent: 12,
    theme: 'dark',
  })
  mocks.saveReaderAppearance.mockReset().mockResolvedValue(undefined)
  mocks.getKeyState.mockReset().mockResolvedValue({
    apiKey: null,
    validationStatus: 'missing',
    validatedAt: null,
  })
  mocks.saveKey.mockReset().mockResolvedValue({
    apiKey: 'unit-test-credential',
    validationStatus: 'unchecked',
    validatedAt: null,
  })
  mocks.validateKey.mockReset().mockResolvedValue({
    apiKey: 'unit-test-credential',
    validationStatus: 'valid',
    validatedAt: 1,
  })
  mocks.deleteKey.mockReset().mockResolvedValue(undefined)
  mocks.clearAll.mockReset().mockResolvedValue(undefined)
})

describe('SettingsView', () => {
  it('loads and saves global reader appearance', async () => {
    const wrapper = mount(SettingsView)
    await flushPromises()
    expect((wrapper.get('select').element as HTMLSelectElement).value).toBe(
      'sans-serif',
    )
    expect(
      (wrapper.get('input[type="range"]').element as HTMLInputElement).value,
    ).toBe('120')

    await wrapper.get('select').setValue('serif')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(mocks.saveReaderAppearance).toHaveBeenCalledWith(
      expect.objectContaining({ fontFamily: 'serif', theme: 'dark' }),
    )
    expect(wrapper.text()).toContain('Настройки сохранены')
  })

  it('checks and deletes a Gemini credential', async () => {
    const wrapper = mount(SettingsView)
    await flushPromises()
    await wrapper
      .get('input[placeholder="Введите ключ Gemini"]')
      .setValue('unit-test-credential')
    const checkButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Проверить ключ'))
    if (checkButton === undefined) throw new Error('Check key button missing')
    await checkButton.trigger('click')
    await flushPromises()
    expect(mocks.validateKey).toHaveBeenCalledWith('unit-test-credential')
    expect(wrapper.text()).toContain('API key действителен')

    const deleteButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Удалить ключ'))
    if (deleteButton === undefined) throw new Error('Delete key button missing')
    await deleteButton.trigger('click')
    expect(mocks.deleteKey).toHaveBeenCalledOnce()
  })

  it('requires confirmation before deleting every local record', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const wrapper = mount(SettingsView)
    await flushPromises()
    const clearButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Удалить все данные'))
    if (clearButton === undefined) throw new Error('Clear data button missing')

    await clearButton.trigger('click')
    expect(mocks.clearAll).not.toHaveBeenCalled()

    confirm.mockReturnValue(true)
    await clearButton.trigger('click')
    await flushPromises()
    expect(mocks.clearAll).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('Все локальные данные удалены')
  })
})

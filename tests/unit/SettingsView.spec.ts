import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SettingsView from '@/views/SettingsView.vue'

const mocks = vi.hoisted(() => ({
  getReaderAppearance: vi.fn(),
  saveReaderAppearance: vi.fn(),
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

beforeEach(() => {
  mocks.getReaderAppearance.mockReset().mockResolvedValue({
    fontSizePercent: 120,
    fontFamily: 'sans-serif',
    lineHeight: 1.8,
    marginPercent: 12,
    theme: 'dark',
  })
  mocks.saveReaderAppearance.mockReset().mockResolvedValue(undefined)
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
})

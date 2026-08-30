import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import PwaUpdateNotice from '@/components/PwaUpdateNotice.vue'

const mocks = vi.hoisted(() => ({
  registrationOptions: null as {
    onNeedRefresh?: () => void
    onOfflineReady?: () => void
  } | null,
  update: vi.fn(),
}))

vi.mock('@/pwa/register', () => ({
  registerSW: (options: typeof mocks.registrationOptions) => {
    mocks.registrationOptions = options
    return mocks.update
  },
}))

beforeEach(() => {
  mocks.registrationOptions = null
  mocks.update.mockReset().mockResolvedValue(undefined)
})

describe('PwaUpdateNotice', () => {
  it('offers an explicit reload when a service worker update is waiting', async () => {
    const wrapper = mount(PwaUpdateNotice)
    mocks.registrationOptions?.onNeedRefresh?.()
    await nextTick()

    expect(wrapper.text()).toContain('Доступно обновление OctaReader')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(mocks.update).toHaveBeenCalledWith(true)
  })

  it('confirms that the app shell is ready offline', async () => {
    const wrapper = mount(PwaUpdateNotice)
    mocks.registrationOptions?.onOfflineReady?.()
    await nextTick()

    expect(wrapper.text()).toContain('готов к работе без интернета')
  })
})

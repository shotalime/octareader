import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/App.vue'

vi.mock('@/components/PwaUpdateNotice.vue', () => ({
  default: { template: '<div />' },
}))

const route = reactive<{
  name: string
  params: { bookId?: string }
}>({ name: 'library', params: {} })

vi.mock('vue-router', () => ({
  useRoute: () => route,
}))

const mountApp = () =>
  mount(App, {
    global: {
      stubs: {
        PwaUpdateNotice: true,
        RouterLink: true,
        RouterView: true,
        Transition: false,
      },
    },
  })

beforeEach(() => {
  route.name = 'library'
  route.params = {}
})

describe('App reader layout', () => {
  it('создаёт по одной колонке на каждый пункт мобильной навигации', () => {
    const wrapper = mountApp()
    const navigation = wrapper.get('nav[aria-label="Мобильная навигация"]')

    expect(navigation.attributes('style')).toContain(
      'grid-template-columns: repeat(4, minmax(0, 1fr))',
    )
  })

  it('скрывает общую оболочку для открытой книги', () => {
    route.name = 'reader'
    route.params = { bookId: 'book-1' }
    const wrapper = mountApp()

    expect(wrapper.find('aside').exists()).toBe(false)
    expect(wrapper.find('header').exists()).toBe(false)
    expect(wrapper.find('nav[aria-label="Мобильная навигация"]').exists()).toBe(
      false,
    )
    expect(wrapper.get('main').classes()).toContain('max-w-none')
    expect(wrapper.get('main').classes()).toContain('p-0')
  })

  it('оставляет общую оболочку на маршруте читалки без книги', () => {
    route.name = 'reader'
    const wrapper = mountApp()

    expect(wrapper.find('aside').exists()).toBe(true)
    expect(wrapper.find('header').exists()).toBe(true)
    expect(wrapper.find('nav[aria-label="Мобильная навигация"]').exists()).toBe(
      true,
    )
    expect(wrapper.get('main').classes()).toContain('max-w-7xl')
  })
})

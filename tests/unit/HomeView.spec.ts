import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import HomeView from '../../src/views/HomeView.vue'

describe('HomeView', () => {
  it('показывает название приложения', () => {
    const wrapper = mount(HomeView)

    expect(wrapper.get('h1').text()).toBe('OctaReader')
  })
})

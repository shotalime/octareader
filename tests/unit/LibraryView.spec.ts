import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import LibraryView from '../../src/views/LibraryView.vue'

describe('LibraryView', () => {
  it('показывает русскоязычное пустое состояние', () => {
    const wrapper = mount(LibraryView)

    expect(wrapper.get('h1').text()).toBe('Книги')
    expect(wrapper.text()).toContain('Библиотека пока пуста')
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
  })
})

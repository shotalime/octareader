import type Contents from 'epubjs/types/contents'
import type Rendition from 'epubjs/types/rendition'
import { describe, expect, it, vi } from 'vitest'

import { detectTappedText, registerEpubTapDetection } from '@/domain/epub-tap'

describe('EPUB tap adapter', () => {
  it('keeps sentence extraction inside the current semantic block', () => {
    document.body.innerHTML =
      '<p id="first">Earlier one. One <em>target</em> sentence.</p><p>Another paragraph.</p>'
    const textNode = document.querySelector('em')?.firstChild
    if (textNode === null || textNode === undefined) {
      throw new Error('Test text node was not created')
    }
    const caretRange = document.createRange()
    caretRange.setStart(textNode, 2)
    caretRange.collapse(true)
    Object.defineProperty(document, 'caretRangeFromPoint', {
      configurable: true,
      value: () => caretRange,
    })
    const contents = {
      document,
      cfiFromRange: () => 'epubcfi(/6/2)',
    } as unknown as Contents

    expect(detectTappedText(contents, 10, 10, 'en')).toEqual({
      word: 'target',
      sentence: 'One target sentence.',
      cfi: 'epubcfi(/6/2)',
    })
  })

  it('uses click as a fallback after a cancelled pointer sequence', () => {
    document.body.innerHTML = '<p>target word</p>'
    const textNode = document.querySelector('p')?.firstChild
    if (!(textNode instanceof Text)) throw new Error('Text node was not created')
    const caretRange = document.createRange()
    caretRange.setStart(textNode, 2)
    caretRange.collapse(true)
    Object.defineProperty(document, 'caretRangeFromPoint', {
      configurable: true,
      value: () => caretRange,
    })
    const contents = {
      document,
      window: { PointerEvent: class PointerEvent {} },
      cfiFromRange: () => 'epubcfi(/6/2)',
    } as unknown as Contents
    let attach: ((contents: Contents) => void) | null = null
    const rendition = {
      hooks: {
        content: {
          register: (callback: (contents: Contents) => void) => {
            attach = callback
          },
          deregister: vi.fn(),
        },
      },
    } as unknown as Rendition
    const onTap = vi.fn()
    const remove = registerEpubTapDetection(rendition, 'en', onTap)
    if (attach === null) throw new Error('Content hook was not registered')
    ;(attach as (contents: Contents) => void)(contents)

    const pointEvent = (type: string): Event => {
      const event = new Event(type, { bubbles: true })
      Object.defineProperties(event, {
        clientX: { value: 10 },
        clientY: { value: 10 },
      })
      return event
    }
    document.dispatchEvent(pointEvent('pointerdown'))
    document.dispatchEvent(pointEvent('pointercancel'))
    document.dispatchEvent(pointEvent('pointerup'))
    document.dispatchEvent(pointEvent('click'))

    expect(onTap).toHaveBeenCalledTimes(1)
    expect(onTap).toHaveBeenCalledWith(
      expect.objectContaining({ word: 'target' }),
    )
    remove()
  })
})

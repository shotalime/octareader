import type Contents from 'epubjs/types/contents'
import { describe, expect, it } from 'vitest'

import { detectTappedText } from '@/domain/epub-tap'

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
})

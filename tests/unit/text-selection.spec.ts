import { describe, expect, it } from 'vitest'

import {
  detectSentenceAt,
  detectWordAt,
  normalizeBookText,
} from '@/domain/text-selection'

const withoutSegmenter = (): null => null

describe('word detection', () => {
  it.each([
    ['«hello,»', 2, 'hello'],
    ["don't stop", 3, "don't"],
    ['mother-in-law arrived', 7, 'mother-in-law'],
    ['state‑of‑the‑art', 8, 'state‑of‑the‑art'],
  ])('detects a word in %s', (text, offset, expected) => {
    expect(detectWordAt(text, offset, 'en', withoutSegmenter)?.word).toBe(
      expected,
    )
  })

  it('does not include surrounding punctuation or whitespace', () => {
    expect(detectWordAt(' hello! ', 0, 'en', withoutSegmenter)).toBeNull()
    expect(detectWordAt(' hello! ', 6, 'en', withoutSegmenter)).toBeNull()
  })

  it('keeps an inner hyphen when Intl.Segmenter is available', () => {
    expect(detectWordAt('mother-in-law', 7, 'en')?.word).toBe('mother-in-law')
  })
})

describe('sentence detection', () => {
  it('returns only the sentence containing the tapped word', () => {
    expect(
      detectSentenceAt(
        'First sentence.  The target is here! Last one.',
        22,
        'target',
        'en',
        withoutSegmenter,
      ),
    ).toBe('The target is here!')
  })

  it('returns null when a complete sentence cannot be established', () => {
    expect(
      detectSentenceAt(
        'An unfinished target fragment',
        14,
        'target',
        'en',
        withoutSegmenter,
      ),
    ).toBeNull()
  })

  it('normalizes whitespace without changing case or punctuation', () => {
    expect(normalizeBookText('  Keep\n  This, Exactly!  ')).toBe(
      'Keep This, Exactly!',
    )
  })
})

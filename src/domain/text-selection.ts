export type DetectedWord = {
  word: string
  start: number
  end: number
}

export type TappedText = {
  word: string
  sentence: string | null
  cfi: string
}

type SegmenterFactory = (
  locale: string,
  granularity: 'word' | 'sentence',
) => Intl.Segmenter | null

const createSegmenter: SegmenterFactory = (locale, granularity) => {
  if (typeof Intl.Segmenter !== 'function') return null
  try {
    return new Intl.Segmenter(locale, { granularity })
  } catch {
    return null
  }
}

const WORD_PATTERN = /\p{L}+(?:['’\-‐‑]\p{L}+)*/gu

const regexWordAt = (text: string, offset: number): DetectedWord | null => {
  for (const match of text.matchAll(WORD_PATTERN)) {
    const start = match.index
    const word = match[0]
    const end = start + word.length
    if (start <= offset && offset < end) return { word, start, end }
  }
  return null
}

export const detectWordAt = (
  text: string,
  offset: number,
  locale: string,
  segmenterFactory: SegmenterFactory = createSegmenter,
): DetectedWord | null => {
  if (offset < 0 || offset >= text.length) return null
  const segmenter = segmenterFactory(locale, 'word')
  if (segmenter !== null) {
    for (const segment of segmenter.segment(text)) {
      const end = segment.index + segment.segment.length
      if (
        segment.isWordLike === true &&
        segment.index <= offset &&
        offset < end
      ) {
        return regexWordAt(text, offset)
      }
    }
    return regexWordAt(text, offset)
  }
  return regexWordAt(text, offset)
}

export const normalizeBookText = (text: string): string =>
  text.replace(/\s+/gu, ' ').trim()

const fallbackSentenceAt = (text: string, offset: number): string | null => {
  const terminator = /[.!?…]/u
  let start = 0
  for (let index = offset - 1; index >= 0; index -= 1) {
    const character = text[index]
    if (character !== undefined && terminator.test(character)) {
      start = index + 1
      break
    }
  }
  let end = -1
  for (let index = offset; index < text.length; index += 1) {
    const character = text[index]
    if (character !== undefined && terminator.test(character)) {
      end = index + 1
      break
    }
  }
  if (end < 0) return null
  const sentence = normalizeBookText(text.slice(start, end))
  return sentence.length > 0 ? sentence : null
}

export const detectSentenceAt = (
  blockText: string,
  wordOffset: number,
  word: string,
  locale: string,
  segmenterFactory: SegmenterFactory = createSegmenter,
): string | null => {
  const text = normalizeBookText(blockText)
  if (wordOffset < 0 || wordOffset >= text.length) return null
  const segmenter = segmenterFactory(locale, 'sentence')
  let sentence: string | null = null
  if (segmenter !== null) {
    for (const segment of segmenter.segment(text)) {
      const end = segment.index + segment.segment.length
      if (segment.index <= wordOffset && wordOffset < end) {
        sentence = normalizeBookText(segment.segment)
        break
      }
    }
  } else {
    sentence = fallbackSentenceAt(text, wordOffset)
  }
  return sentence !== null && sentence.includes(word) ? sentence : null
}

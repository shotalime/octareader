import type Contents from 'epubjs/types/contents'
import type Rendition from 'epubjs/types/rendition'

import {
  detectSentenceAt,
  detectWordAt,
  normalizeBookText,
  type TappedText,
} from '@/domain/text-selection'

type CaretPoint = { offsetNode: Node; offset: number }
type CaretDocument = Document & {
  caretPositionFromPoint?: (x: number, y: number) => CaretPoint | null
  caretRangeFromPoint?: (x: number, y: number) => Range | null
}
type ContentHook = {
  register: (callback: (contents: Contents) => void) => void
  deregister: (callback: (contents: Contents) => void) => void
}
type PointEvent = Event & { clientX: number; clientY: number }
type RegisteredDocument = {
  activate: (event: Event) => void
  pointerDown: ((event: Event) => void) | null
}

const SEMANTIC_BLOCK_SELECTOR = 'p,h1,h2,h3,h4,h5,h6,li'

const isPointEvent = (event: Event): event is PointEvent =>
  'clientX' in event &&
  typeof event.clientX === 'number' &&
  'clientY' in event &&
  typeof event.clientY === 'number'

const caretAtPoint = (
  document: Document,
  x: number,
  y: number,
): CaretPoint | null => {
  const caretDocument = document as CaretDocument
  const position = caretDocument.caretPositionFromPoint?.(x, y)
  if (position !== null && position !== undefined) return position
  const range = caretDocument.caretRangeFromPoint?.(x, y)
  return range === null || range === undefined
    ? null
    : { offsetNode: range.startContainer, offset: range.startOffset }
}

const semanticBlockFor = (node: Text): Element | null =>
  node.parentElement?.closest(SEMANTIC_BLOCK_SELECTOR) ?? null

const normalizedOffsetInBlock = (
  block: Element,
  node: Text,
  wordEnd: number,
  word: string,
): number => {
  const range = block.ownerDocument.createRange()
  range.selectNodeContents(block)
  range.setEnd(node, wordEnd)
  return normalizeBookText(range.toString()).length - word.length
}

export const detectTappedText = (
  contents: Contents,
  x: number,
  y: number,
  locale: string,
): TappedText | null => {
  const caret = caretAtPoint(contents.document, x, y)
  if (caret?.offsetNode.nodeType !== 3) return null
  const textNode = caret.offsetNode as Text
  const detectedWord = detectWordAt(textNode.data, caret.offset, locale)
  if (detectedWord === null) return null

  const wordRange = contents.document.createRange()
  wordRange.setStart(textNode, detectedWord.start)
  wordRange.setEnd(textNode, detectedWord.end)
  const block = semanticBlockFor(textNode)
  const sentence =
    block === null
      ? null
      : detectSentenceAt(
          block.textContent ?? '',
          normalizedOffsetInBlock(
            block,
            textNode,
            detectedWord.end,
            detectedWord.word,
          ),
          detectedWord.word,
          locale,
        )

  return {
    word: detectedWord.word,
    sentence,
    cfi: contents.cfiFromRange(wordRange),
  }
}

export const registerEpubTapDetection = (
  rendition: Rendition,
  locale: string,
  onTap: (selection: TappedText) => void,
): (() => void) => {
  const hook = rendition.hooks.content as unknown as ContentHook
  const documents = new Map<Document, RegisteredDocument>()
  const attach = (contents: Contents): void => {
    if (documents.has(contents.document)) return
    const detect = (event: Event): void => {
      if (!isPointEvent(event)) return
      const selection = detectTappedText(
        contents,
        event.clientX,
        event.clientY,
        locale,
      )
      if (selection !== null) onTap(selection)
    }
    if ('PointerEvent' in contents.window) {
      let pointerStart: { x: number; y: number } | null = null
      const pointerDown = (event: Event): void => {
        if (isPointEvent(event)) {
          pointerStart = { x: event.clientX, y: event.clientY }
        }
      }
      const pointerUp = (event: Event): void => {
        if (!isPointEvent(event) || pointerStart === null) return
        const moved = Math.hypot(
          event.clientX - pointerStart.x,
          event.clientY - pointerStart.y,
        )
        pointerStart = null
        if (moved <= 10) detect(event)
      }
      documents.set(contents.document, {
        activate: pointerUp,
        pointerDown,
      })
      contents.document.addEventListener('pointerdown', pointerDown)
      contents.document.addEventListener('pointerup', pointerUp)
    } else {
      documents.set(contents.document, {
        activate: detect,
        pointerDown: null,
      })
      contents.document.addEventListener('click', detect)
    }
  }
  hook.register(attach)

  return () => {
    hook.deregister(attach)
    for (const [document, registered] of documents) {
      document.removeEventListener('pointerup', registered.activate)
      document.removeEventListener('click', registered.activate)
      if (registered.pointerDown !== null) {
        document.removeEventListener('pointerdown', registered.pointerDown)
      }
    }
    documents.clear()
  }
}

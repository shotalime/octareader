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
  click: (event: Event) => void
  pointerDown: ((event: Event) => void) | null
  pointerUp: ((event: Event) => void) | null
  pointerCancel: (() => void) | null
}

const SEMANTIC_BLOCK_SELECTOR = 'p,h1,h2,h3,h4,h5,h6,li'
const MAX_TAP_MOVEMENT = 10
const COMPATIBILITY_CLICK_DELAY = 750

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
    const detect = (event: Event): boolean => {
      if (!isPointEvent(event)) return false
      const selection = detectTappedText(
        contents,
        event.clientX,
        event.clientY,
        locale,
      )
      if (selection === null) return false
      onTap(selection)
      return true
    }
    let lastPointerTap: { x: number; y: number; at: number } | null = null
    const click = (event: Event): void => {
      if (!isPointEvent(event)) return
      const isCompatibilityClick =
        lastPointerTap !== null &&
        event.timeStamp - lastPointerTap.at <= COMPATIBILITY_CLICK_DELAY &&
        Math.hypot(
          event.clientX - lastPointerTap.x,
          event.clientY - lastPointerTap.y,
        ) <= MAX_TAP_MOVEMENT
      if (!isCompatibilityClick) detect(event)
    }
    contents.document.addEventListener('click', click)
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
        if (moved <= MAX_TAP_MOVEMENT && detect(event)) {
          lastPointerTap = {
            x: event.clientX,
            y: event.clientY,
            at: event.timeStamp,
          }
        }
      }
      const pointerCancel = (): void => {
        pointerStart = null
      }
      documents.set(contents.document, {
        click,
        pointerDown,
        pointerUp,
        pointerCancel,
      })
      contents.document.addEventListener('pointerdown', pointerDown)
      contents.document.addEventListener('pointerup', pointerUp)
      contents.document.addEventListener('pointercancel', pointerCancel)
    } else {
      documents.set(contents.document, {
        click,
        pointerDown: null,
        pointerUp: null,
        pointerCancel: null,
      })
    }
  }
  hook.register(attach)

  return () => {
    hook.deregister(attach)
    for (const [document, registered] of documents) {
      document.removeEventListener('click', registered.click)
      if (registered.pointerDown !== null) {
        document.removeEventListener('pointerdown', registered.pointerDown)
      }
      if (registered.pointerUp !== null) {
        document.removeEventListener('pointerup', registered.pointerUp)
      }
      if (registered.pointerCancel !== null) {
        document.removeEventListener('pointercancel', registered.pointerCancel)
      }
    }
    documents.clear()
  }
}

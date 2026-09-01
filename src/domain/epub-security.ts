import type Book from 'epubjs/types/book'

type ContentHook = {
  register: (callback: (document: Document) => void) => void
  deregister: (callback: (document: Document) => void) => void
}

const BLOCKED_ELEMENTS =
  'script,iframe,frame,frameset,object,embed,applet,portal'
const URL_ATTRIBUTES = new Set([
  'action',
  'background',
  'cite',
  'data',
  'formaction',
  'href',
  'longdesc',
  'poster',
  'src',
  'xlink:href',
])
const SAFE_URL_PATTERN = /^(?:#|\.?\.?\/|\/(?!\/)|blob:|data:image\/|data:font\/)/i
const CSP = [
  "default-src 'none'",
  "img-src data: blob:",
  "media-src data: blob:",
  "font-src data: blob:",
  "style-src 'unsafe-inline' blob:",
  "script-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
  "connect-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

const normalizedUrl = (value: string): string =>
  [...value]
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0
      return codePoint > 0x20 && codePoint !== 0x7f
    })
    .join('')
    .toLowerCase()

const isSafeBookUrl = (value: string): boolean => {
  const normalized = normalizedUrl(value)
  if (normalized.length === 0) return true
  if (SAFE_URL_PATTERN.test(normalized)) return true
  return !/^[a-z][a-z\d+.-]*:/i.test(normalized)
}

export const sanitizeEpubDocument = (document: Document): void => {
  for (const element of document.querySelectorAll(BLOCKED_ELEMENTS)) {
    element.remove()
  }

  for (const element of document.querySelectorAll('*')) {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase()
      if (name.startsWith('on')) {
        element.removeAttributeNode(attribute)
        continue
      }
      if (name === 'srcdoc') {
        element.removeAttributeNode(attribute)
        continue
      }
      if (URL_ATTRIBUTES.has(name) && !isSafeBookUrl(attribute.value)) {
        element.removeAttributeNode(attribute)
      }
    }

    if (element.localName.toLowerCase() === 'meta') {
      const directive = element.getAttribute('http-equiv')?.toLowerCase()
      if (directive === 'refresh' || directive === 'content-security-policy') {
        element.remove()
      }
    }
  }

  const head = document.querySelector('head')
  if (head === null) return
  const policy = document.createElementNS(
    document.documentElement.namespaceURI,
    'meta',
  )
  policy.setAttribute('http-equiv', 'Content-Security-Policy')
  policy.setAttribute('content', CSP)
  head.prepend(policy)
}

export const secureEpubScriptEnvironment = (book: Book): (() => void) => {
  const hook = book.spine.hooks.content as unknown as ContentHook
  const sanitize = (document: Document): void => sanitizeEpubDocument(document)
  hook.register(sanitize)
  return () => hook.deregister(sanitize)
}

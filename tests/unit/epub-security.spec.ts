import { describe, expect, it } from 'vitest'

import { sanitizeEpubDocument } from '@/domain/epub-security'

const parseXhtml = (body: string): XMLDocument =>
  new DOMParser().parseFromString(
    `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Test</title></head><body>${body}</body></html>`,
    'application/xhtml+xml',
  )

describe('EPUB scripted-content security', () => {
  it('removes executable elements, handlers, refreshes, and active URLs', () => {
    const document = parseXhtml(`
      <script>globalThis.compromised = true</script>
      <iframe srcdoc="&lt;script>globalThis.compromised = true&lt;/script>" />
      <object data="payload.html" />
      <p onclick="globalThis.compromised = true">Safe text</p>
      <a href="java&#x0A;script:globalThis.compromised=true">Unsafe link</a>
      <img src="https://tracker.example/pixel.png" onerror="globalThis.compromised=true" />
      <meta http-equiv="refresh" content="0;url=https://example.com" />
    `)

    sanitizeEpubDocument(document)

    expect(
      document.querySelector('script,iframe,object,meta[http-equiv="refresh"]'),
    ).toBeNull()
    expect(document.querySelector('p')?.hasAttribute('onclick')).toBe(false)
    expect(document.querySelector('a')?.hasAttribute('href')).toBe(false)
    expect(document.querySelector('img')?.hasAttribute('src')).toBe(false)
    expect(document.querySelector('img')?.hasAttribute('onerror')).toBe(false)
  })

  it('prepends a restrictive policy while preserving local book resources', () => {
    const document = parseXhtml(`
      <img src="../images/cover.jpg" />
      <a href="#chapter-2">Chapter 2</a>
      <meta http-equiv="Content-Security-Policy" content="script-src *" />
    `)

    sanitizeEpubDocument(document)

    const policy = document.head.firstElementChild
    expect(policy?.getAttribute('http-equiv')).toBe('Content-Security-Policy')
    expect(policy?.getAttribute('content')).toContain("script-src 'none'")
    expect(document.querySelector('img')?.getAttribute('src')).toBe(
      '../images/cover.jpg',
    )
    expect(document.querySelector('a')?.getAttribute('href')).toBe(
      '#chapter-2',
    )
    expect(
      document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]'),
    ).toHaveLength(1)
  })
})

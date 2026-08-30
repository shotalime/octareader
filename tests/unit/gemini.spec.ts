import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_AI_MODEL } from '@/config/ai'
import { GeminiProvider } from '@/domain/ai/gemini'

const request = {
  sourceText: 'running',
  sentence: 'She is running home.',
  sourceLanguage: 'en',
  targetLanguage: 'ru',
}
const result = {
  schemaVersion: 1,
  status: 'translated',
  sourceText: 'running',
  lemma: 'run',
  partOfSpeech: 'verb',
  translation: 'бежать',
}
const successResponse = (): Response =>
  new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(result) }] } }],
    }),
    { status: 200 },
  )

describe('GeminiProvider', () => {
  const fetcher = vi.fn()
  const delay = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    fetcher.mockReset().mockResolvedValue(successResponse())
    delay.mockClear()
  })

  it('uses configured model, structured JSON, context, and a header credential', async () => {
    const provider = new GeminiProvider(DEFAULT_AI_MODEL, fetcher, delay)
    await expect(
      provider.translate(request, 'unit-test-credential'),
    ).resolves.toEqual(result)
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit]
    expect(url).toContain(`/models/${DEFAULT_AI_MODEL}:generateContent`)
    expect(url).not.toContain('unit-test-credential')
    expect(init.headers).toMatchObject({
      'x-goog-api-key': 'unit-test-credential',
    })
    expect(init.body).not.toContain('unit-test-credential')
    expect(init.body).toContain(request.sentence)
    expect(init.body).toContain('responseSchema')
  })

  it.each([
    [400, {}, 'invalid_key'],
    [403, {}, 'invalid_key'],
    [429, {}, 'quota_exhausted'],
    [429, { 'retry-after': '5' }, 'rate_limited'],
    [500, {}, 'unknown'],
  ])('maps HTTP %s to %s', async (status, headers, code) => {
    fetcher.mockResolvedValue(new Response('{}', { status, headers }))
    await expect(
      new GeminiProvider(DEFAULT_AI_MODEL, fetcher, delay).translate(
        request,
        'unit-test-credential',
      ),
    ).rejects.toMatchObject({ code, message: code })
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('retries a temporary network failure exactly once', async () => {
    fetcher
      .mockRejectedValueOnce(new TypeError('network'))
      .mockResolvedValueOnce(successResponse())
    await expect(
      new GeminiProvider(DEFAULT_AI_MODEL, fetcher, delay).translate(
        request,
        'unit-test-credential',
      ),
    ).resolves.toEqual(result)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(delay).toHaveBeenCalledOnce()
  })

  it('does not retry after the second network failure', async () => {
    fetcher.mockRejectedValue(new TypeError('network'))
    await expect(
      new GeminiProvider(DEFAULT_AI_MODEL, fetcher, delay).translate(
        request,
        'unit-test-credential',
      ),
    ).rejects.toMatchObject({ code: 'offline' })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it.each([
    new Response('{broken', { status: 200 }),
    new Response(JSON.stringify({ candidates: [] }), { status: 200 }),
    new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: '{"status":"bad"}' }] } }],
      }),
      { status: 200 },
    ),
  ])('rejects an invalid provider response', async (response) => {
    fetcher.mockResolvedValue(response)
    await expect(
      new GeminiProvider(DEFAULT_AI_MODEL, fetcher, delay).translate(
        request,
        'unit-test-credential',
      ),
    ).rejects.toMatchObject({ code: 'invalid_response' })
  })

  it('validates a key without putting it in the URL', async () => {
    fetcher.mockResolvedValue(new Response('{}', { status: 200 }))
    await new GeminiProvider(DEFAULT_AI_MODEL, fetcher, delay).validateKey(
      'unit-test-credential',
    )
    expect(fetcher.mock.calls[0]?.[0]).not.toContain('unit-test-credential')
  })
})

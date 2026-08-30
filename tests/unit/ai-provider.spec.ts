import { describe, expect, it } from 'vitest'

import {
  AiProviderError,
  MockAiProvider,
  parseTranslationResult,
  type TranslationResult,
} from '@/domain/ai/provider'

const translated: TranslationResult = {
  schemaVersion: 1,
  status: 'translated',
  sourceText: 'running',
  lemma: 'run',
  partOfSpeech: 'verb',
  translation: 'бежать',
}

describe('translation result validation', () => {
  it.each([
    translated,
    {
      ...translated,
      status: 'proper_noun',
      lemma: 'London',
      partOfSpeech: 'noun',
      translation: null,
    },
    {
      ...translated,
      status: 'not_translatable',
      lemma: null,
      partOfSpeech: 'unknown',
      translation: null,
    },
  ])('accepts a valid $status result', (value) => {
    expect(parseTranslationResult({ ...value, ignored: true })).toEqual(value)
  })

  it.each([
    null,
    { ...translated, schemaVersion: 2 },
    { ...translated, status: 'other-status' },
    { ...translated, partOfSpeech: 'person' },
    { ...translated, translation: ' ' },
    { ...translated, status: 'proper_noun', translation: 'Лондон' },
    { ...translated, sourceText: '' },
  ])('rejects an invalid response', (value) => {
    expect(() => parseTranslationResult(value)).toThrowError(
      expect.objectContaining({ code: 'invalid_response' }),
    )
  })
})

describe('MockAiProvider', () => {
  it('implements provider behavior without a model dependency', async () => {
    const provider = new MockAiProvider(translated)
    await expect(
      provider.translate(
        {
          sourceText: 'running',
          sentence: null,
          sourceLanguage: 'en',
          targetLanguage: 'ru',
        },
        'test-key',
      ),
    ).resolves.toEqual(translated)
    expect(provider.requests).toHaveLength(1)
  })

  it('can return a controlled domain error', async () => {
    const provider = new MockAiProvider(new AiProviderError('offline'))
    await expect(provider.validateKey('test-key')).rejects.toMatchObject({
      code: 'offline',
    })
  })
})

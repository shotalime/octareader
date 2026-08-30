import 'fake-indexeddb/auto'

import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { OctaReaderDatabase } from '@/data/database'
import {
  AiProviderError,
  type AiProvider,
  type TranslationRequest,
  type TranslationResult,
} from '@/domain/ai/provider'
import {
  TranslationService,
  translationCacheIdentity,
  translationCacheKey,
} from '@/domain/translation'

const databaseNames: string[] = []
const createDatabase = (): OctaReaderDatabase => {
  const name = `translation-test-${crypto.randomUUID()}`
  databaseNames.push(name)
  return new OctaReaderDatabase(name)
}

const request: TranslationRequest = {
  sourceText: 'Running',
  sentence: 'She is running home.',
  sourceLanguage: 'en',
  targetLanguage: 'ru',
}

const translated: TranslationResult = {
  schemaVersion: 1,
  status: 'translated',
  sourceText: 'Running',
  lemma: 'run',
  partOfSpeech: 'verb',
  translation: 'бежит',
}

const properNoun: TranslationResult = {
  schemaVersion: 1,
  status: 'proper_noun',
  sourceText: 'Running',
  lemma: 'Running',
  partOfSpeech: 'noun',
  translation: null,
}

const translate = vi.fn<AiProvider['translate']>()
const keyForTranslation = vi.fn<() => Promise<string>>()
const provider: AiProvider = {
  id: 'test-provider',
  translate,
  validateKey: vi.fn(),
}

beforeEach(() => {
  translate.mockReset().mockResolvedValue(translated)
  keyForTranslation.mockReset().mockResolvedValue('unit-test-credential')
})

afterEach(async () => {
  await Promise.all(databaseNames.splice(0).map((name) => Dexie.delete(name)))
})

describe('TranslationService', () => {
  it('caches a successful result and avoids a second network request', async () => {
    const db = createDatabase()
    const service = new TranslationService(
      db,
      provider,
      { keyForTranslation },
      'test-model',
    )

    await expect(service.translate(request)).resolves.toEqual({
      result: translated,
      fromCache: false,
    })
    await expect(service.translate(request)).resolves.toEqual({
      result: translated,
      fromCache: true,
    })
    expect(keyForTranslation).toHaveBeenCalledOnce()
    expect(translate).toHaveBeenCalledOnce()
    expect(await db.translationCache.count()).toBe(1)
    db.close()
  })

  it('returns cached proper-noun results offline without reading the API key', async () => {
    const db = createDatabase()
    translate.mockResolvedValue(properNoun)
    const service = new TranslationService(
      db,
      provider,
      { keyForTranslation },
      'test-model',
    )
    await expect(service.translate(request)).resolves.toEqual({
      result: properNoun,
      fromCache: false,
    })
    keyForTranslation.mockClear()
    translate.mockClear()
    keyForTranslation.mockRejectedValue(new AiProviderError('offline'))

    await expect(service.translate(request)).resolves.toEqual({
      result: properNoun,
      fromCache: true,
    })
    expect(keyForTranslation).not.toHaveBeenCalled()
    expect(translate).not.toHaveBeenCalled()
    db.close()
  })

  it('deduplicates concurrent requests with the same cache identity', async () => {
    const db = createDatabase()
    let resolveTranslation: ((result: TranslationResult) => void) | undefined
    translate.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveTranslation = resolve
        }),
    )
    const service = new TranslationService(
      db,
      provider,
      { keyForTranslation },
      'test-model',
    )
    const first = service.translate(request)
    const second = service.translate(request)
    await vi.waitFor(() => expect(translate).toHaveBeenCalledOnce())
    resolveTranslation?.(translated)

    await expect(Promise.all([first, second])).resolves.toEqual([
      { result: translated, fromCache: false },
      { result: translated, fromCache: false },
    ])
    expect(keyForTranslation).toHaveBeenCalledOnce()
    db.close()
  })

  it('does not cache provider errors', async () => {
    const db = createDatabase()
    translate.mockRejectedValue(new AiProviderError('quota_exhausted'))
    const service = new TranslationService(
      db,
      provider,
      { keyForTranslation },
      'test-model',
    )
    await expect(service.translate(request)).rejects.toMatchObject({
      code: 'quota_exhausted',
    })
    expect(await db.translationCache.count()).toBe(0)
    db.close()
  })

  it('rejects and does not cache a result for a different source word', async () => {
    const db = createDatabase()
    translate.mockResolvedValue({ ...translated, sourceText: 'walking' })
    const service = new TranslationService(
      db,
      provider,
      { keyForTranslation },
      'test-model',
    )
    await expect(service.translate(request)).rejects.toMatchObject({
      code: 'invalid_response',
    })
    expect(await db.translationCache.count()).toBe(0)
    db.close()
  })
})

describe('translation cache identity', () => {
  it('normalizes text but includes context, languages, provider, and model', () => {
    const base = translationCacheKey(
      translationCacheIdentity(request, 'gemini', 'model-a'),
    )
    const normalized = translationCacheKey(
      translationCacheIdentity(
        {
          ...request,
          sourceText: ' running ',
          sentence: 'She  is running home.',
        },
        'gemini',
        'model-a',
      ),
    )
    expect(normalized).toBe(base)

    const variants = [
      [{ ...request, sentence: null }, 'gemini', 'model-a'],
      [{ ...request, sourceLanguage: 'de' }, 'gemini', 'model-a'],
      [{ ...request, targetLanguage: 'en' }, 'gemini', 'model-a'],
      [request, 'other-provider', 'model-a'],
      [request, 'gemini', 'model-b'],
    ] as const
    for (const [variantRequest, variantProvider, variantModel] of variants) {
      expect(
        translationCacheKey(
          translationCacheIdentity(
            variantRequest,
            variantProvider,
            variantModel,
          ),
        ),
      ).not.toBe(base)
    }
    expect(base).not.toContain('unit-test-credential')
  })
})

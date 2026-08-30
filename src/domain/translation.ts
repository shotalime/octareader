import { DEFAULT_AI_MODEL } from '@/config/ai'
import { database, type OctaReaderDatabase } from '@/data/database'
import type { TranslationCacheEntry } from '@/data/models'
import { geminiProvider } from '@/domain/ai/gemini'
import {
  AiProviderError,
  parseTranslationResult,
  type AiProvider,
  type TranslationRequest,
  type TranslationResult,
} from '@/domain/ai/provider'
import { apiKeyService, type ApiKeyService } from '@/domain/api-key'
import { normalizeLanguageCode } from '@/domain/languages'

export type TranslationOutcome = {
  result: TranslationResult
  fromCache: boolean
}

const normalizeWhitespace = (value: string): string =>
  value.normalize('NFC').replace(/\s+/gu, ' ').trim()

const normalizeLanguage = (value: string): string =>
  normalizeLanguageCode(value) ?? value.normalize('NFKC').trim()

export const normalizeTranslationCacheText = (
  value: string,
  language: string,
): string => normalizeWhitespace(value).toLocaleLowerCase(language)

export type TranslationCacheIdentity = {
  normalizedSourceText: string
  normalizedSentence: string
  sourceLanguage: string
  targetLanguage: string
  provider: string
  model: string
}

export const translationCacheIdentity = (
  request: TranslationRequest,
  provider: string,
  model: string,
): TranslationCacheIdentity => {
  const sourceLanguage = normalizeLanguage(request.sourceLanguage)
  return {
    normalizedSourceText: normalizeTranslationCacheText(
      request.sourceText,
      sourceLanguage,
    ),
    normalizedSentence:
      request.sentence === null
        ? ''
        : normalizeTranslationCacheText(request.sentence, sourceLanguage),
    sourceLanguage,
    targetLanguage: normalizeLanguage(request.targetLanguage),
    provider,
    model,
  }
}

export const translationCacheKey = (
  identity: TranslationCacheIdentity,
): string =>
  JSON.stringify([
    identity.normalizedSourceText,
    identity.normalizedSentence,
    identity.sourceLanguage,
    identity.targetLanguage,
    identity.provider,
    identity.model,
  ])

const validForRequest = (
  result: TranslationResult,
  request: TranslationRequest,
): boolean =>
  normalizeTranslationCacheText(result.sourceText, request.sourceLanguage) ===
  normalizeTranslationCacheText(request.sourceText, request.sourceLanguage)

export class TranslationService {
  private readonly inFlight = new Map<string, Promise<TranslationOutcome>>()

  constructor(
    private readonly db: OctaReaderDatabase = database,
    private readonly provider: AiProvider = geminiProvider,
    private readonly keys: Pick<
      ApiKeyService,
      'keyForTranslation'
    > = apiKeyService,
    private readonly model = DEFAULT_AI_MODEL,
  ) {}

  async translate(request: TranslationRequest): Promise<TranslationOutcome> {
    const normalizedRequest: TranslationRequest = {
      sourceText: normalizeWhitespace(request.sourceText),
      sentence:
        request.sentence === null
          ? null
          : normalizeWhitespace(request.sentence) || null,
      sourceLanguage: normalizeLanguage(request.sourceLanguage),
      targetLanguage: normalizeLanguage(request.targetLanguage),
    }
    if (
      normalizedRequest.sourceText.length === 0 ||
      normalizedRequest.sourceLanguage.length === 0 ||
      normalizedRequest.targetLanguage.length === 0
    ) {
      throw new AiProviderError('unknown')
    }

    const identity = translationCacheIdentity(
      normalizedRequest,
      this.provider.id,
      this.model,
    )
    const key = translationCacheKey(identity)
    let cached: TranslationCacheEntry | undefined
    try {
      cached = await this.db.translationCache.get(key)
    } catch (error: unknown) {
      throw new AiProviderError('unknown', { cause: error })
    }
    if (cached !== undefined) {
      try {
        const result = parseTranslationResult(cached.result)
        if (!validForRequest(result, normalizedRequest)) {
          throw new AiProviderError('invalid_response')
        }
        return { result, fromCache: true }
      } catch {
        await this.db.translationCache.delete(key)
      }
    }

    const existing = this.inFlight.get(key)
    if (existing !== undefined) return existing

    const pending = this.fetchAndCache(
      key,
      identity,
      normalizedRequest,
    ).finally(() => this.inFlight.delete(key))
    this.inFlight.set(key, pending)
    return pending
  }

  private async fetchAndCache(
    key: string,
    identity: TranslationCacheIdentity,
    request: TranslationRequest,
  ): Promise<TranslationOutcome> {
    const apiKey = await this.keys.keyForTranslation()
    const result = parseTranslationResult(
      await this.provider.translate(request, apiKey),
    )
    if (!validForRequest(result, request)) {
      throw new AiProviderError('invalid_response')
    }
    try {
      await this.db.translationCache.put({
        key,
        ...identity,
        result,
        createdAt: Date.now(),
      })
    } catch (error: unknown) {
      throw new AiProviderError('unknown', { cause: error })
    }
    return { result, fromCache: false }
  }
}

export const translationService = new TranslationService()

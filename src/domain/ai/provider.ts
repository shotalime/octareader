export const PARTS_OF_SPEECH = [
  'noun',
  'verb',
  'adjective',
  'adverb',
  'pronoun',
  'preposition',
  'conjunction',
  'interjection',
  'determiner',
  'numeral',
  'particle',
  'other',
  'unknown',
] as const

export type PartOfSpeech = (typeof PARTS_OF_SPEECH)[number]
export type TranslationStatus =
  'translated' | 'proper_noun' | 'not_translatable'

export type TranslationResult = {
  schemaVersion: 1
  status: TranslationStatus
  sourceText: string
  lemma: string | null
  partOfSpeech: PartOfSpeech
  translation: string | null
}

export type TranslationRequest = {
  sourceText: string
  sentence: string | null
  sourceLanguage: string
  targetLanguage: string
}

export interface AiProvider {
  readonly id: string
  translate(
    request: TranslationRequest,
    apiKey: string,
  ): Promise<TranslationResult>
  validateKey(apiKey: string): Promise<void>
}

export type AiErrorCode =
  | 'invalid_key'
  | 'quota_exhausted'
  | 'rate_limited'
  | 'offline'
  | 'invalid_response'
  | 'unknown'

export class AiProviderError extends Error {
  constructor(
    readonly code: AiErrorCode,
    options?: ErrorOptions,
  ) {
    super(code, options)
    this.name = 'AiProviderError'
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isPartOfSpeech = (value: unknown): value is PartOfSpeech =>
  PARTS_OF_SPEECH.some((part) => part === value)

export const parseTranslationResult = (value: unknown): TranslationResult => {
  if (!isRecord(value)) throw new AiProviderError('invalid_response')
  const {
    schemaVersion,
    status,
    sourceText,
    lemma,
    partOfSpeech,
    translation,
  } = value
  if (
    schemaVersion !== 1 ||
    (status !== 'translated' &&
      status !== 'proper_noun' &&
      status !== 'not_translatable') ||
    typeof sourceText !== 'string' ||
    sourceText.trim().length === 0 ||
    (lemma !== null &&
      (typeof lemma !== 'string' || lemma.trim().length === 0)) ||
    !isPartOfSpeech(partOfSpeech) ||
    (status === 'translated'
      ? typeof translation !== 'string' || translation.trim().length === 0
      : translation !== null)
  ) {
    throw new AiProviderError('invalid_response')
  }
  return {
    schemaVersion,
    status,
    sourceText,
    lemma,
    partOfSpeech,
    translation: translation as string | null,
  }
}

export class MockAiProvider implements AiProvider {
  readonly id = 'mock'
  readonly requests: TranslationRequest[] = []

  constructor(private readonly result: TranslationResult | AiProviderError) {}

  translate(
    request: TranslationRequest,
    _apiKey: string,
  ): Promise<TranslationResult> {
    this.requests.push(request)
    return this.result instanceof AiProviderError
      ? Promise.reject(this.result)
      : Promise.resolve(this.result)
  }

  validateKey(_apiKey: string): Promise<void> {
    if (this.result instanceof AiProviderError)
      return Promise.reject(this.result)
    return Promise.resolve()
  }
}

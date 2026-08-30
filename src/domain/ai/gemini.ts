import { DEFAULT_AI_MODEL } from '@/config/ai'
import {
  AiProviderError,
  PARTS_OF_SPEECH,
  parseTranslationResult,
  type AiProvider,
  type TranslationRequest,
  type TranslationResult,
} from '@/domain/ai/provider'

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>
type Delay = (milliseconds: number) => Promise<void>

const API_ORIGIN = 'https://generativelanguage.googleapis.com'
const NETWORK_RETRY_DELAY_MS = 350

const responseSchema = {
  type: 'object',
  properties: {
    schemaVersion: { type: 'integer', enum: [1] },
    status: {
      type: 'string',
      enum: ['translated', 'proper_noun', 'not_translatable'],
    },
    sourceText: { type: 'string' },
    lemma: { type: ['string', 'null'] },
    partOfSpeech: { type: 'string', enum: [...PARTS_OF_SPEECH] },
    translation: { type: ['string', 'null'] },
  },
  required: [
    'schemaVersion',
    'status',
    'sourceText',
    'lemma',
    'partOfSpeech',
    'translation',
  ],
} as const

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown
  } catch (error: unknown) {
    throw new AiProviderError('invalid_response', { cause: error })
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isUnknownArray = (value: unknown): value is unknown[] =>
  Array.isArray(value)

const errorReason = (value: unknown): string | null => {
  if (!isRecord(value) || !isRecord(value.error)) return null
  const details = value.error.details
  if (!isUnknownArray(details)) return null
  for (const detail of details) {
    if (isRecord(detail) && typeof detail.reason === 'string') {
      return detail.reason
    }
  }
  return null
}

const responseErrorReason = async (
  response: Response,
): Promise<string | null> => {
  try {
    return errorReason(parseJson(await response.text()))
  } catch {
    return null
  }
}

const providerErrorFor = async (
  response: Response,
): Promise<AiProviderError> => {
  if (
    response.status === 400 ||
    response.status === 401 ||
    response.status === 403
  ) {
    return new AiProviderError('invalid_key')
  }
  if (response.status === 429) {
    const reason = await responseErrorReason(response)
    return new AiProviderError(
      reason === 'RATE_LIMIT_EXCEEDED' || response.headers.has('retry-after')
        ? 'rate_limited'
        : 'quota_exhausted',
    )
  }
  return new AiProviderError('unknown')
}

const responseText = (value: unknown): string | null => {
  if (!isRecord(value) || !isUnknownArray(value.candidates)) return null
  const candidate = value.candidates[0]
  if (!isRecord(candidate) || !isRecord(candidate.content)) return null
  const parts = candidate.content.parts
  if (!isUnknownArray(parts)) return null
  const part = parts[0]
  return isRecord(part) && typeof part.text === 'string' ? part.text : null
}

const translationPrompt = (request: TranslationRequest): string =>
  `
Translate one word for a language learner. Return only JSON matching the schema.
Use the sentence only to choose the single context-appropriate meaning.
Return proper_noun for a proper name and do not translate it.
Return not_translatable when the input is not a translatable word.
Use a stable English partOfSpeech enum value. Do not add explanations.
Input: ${JSON.stringify(request)}
`.trim()

const defaultDelay: Delay = (milliseconds) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds))

export class GeminiProvider implements AiProvider {
  readonly id = 'gemini'

  constructor(
    private readonly model = DEFAULT_AI_MODEL,
    private readonly fetcher: Fetcher = globalThis.fetch.bind(globalThis),
    private readonly delay: Delay = defaultDelay,
  ) {}

  private modelUrl(suffix = ':generateContent'): string {
    return `${API_ORIGIN}/v1beta/models/${encodeURIComponent(this.model)}${suffix}`
  }

  private async fetchWithNetworkRetry(
    input: RequestInfo | URL,
    init: RequestInit,
  ): Promise<Response> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.fetcher(input, init)
      } catch (error: unknown) {
        if (attempt === 0 && navigator.onLine) {
          await this.delay(NETWORK_RETRY_DELAY_MS)
          continue
        }
        throw new AiProviderError('offline', { cause: error })
      }
    }
    throw new AiProviderError('offline')
  }

  async translate(
    request: TranslationRequest,
    apiKey: string,
  ): Promise<TranslationResult> {
    const response = await this.fetchWithNetworkRetry(this.modelUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: translationPrompt(request) }] },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema,
        },
      }),
    })
    if (!response.ok) throw await providerErrorFor(response)
    const text = responseText(parseJson(await response.text()))
    if (text === null) throw new AiProviderError('invalid_response')
    const result = parseTranslationResult(parseJson(text))
    if (result.sourceText !== request.sourceText) {
      throw new AiProviderError('invalid_response')
    }
    return result
  }

  async validateKey(apiKey: string): Promise<void> {
    const response = await this.fetchWithNetworkRetry(this.modelUrl(''), {
      method: 'GET',
      headers: { 'x-goog-api-key': apiKey },
    })
    if (!response.ok) throw await providerErrorFor(response)
  }
}

export const geminiProvider = new GeminiProvider()

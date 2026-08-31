import { database, type OctaReaderDatabase } from '@/data/database'
import type { Setting } from '@/data/models'
import { geminiProvider } from '@/domain/ai/gemini'
import { AiProviderError, type AiProvider } from '@/domain/ai/provider'

export const API_KEY_SETTING_KEY = 'gemini-api-key'

export type KeyValidationStatus =
  'missing' | 'unchecked' | 'valid' | 'invalid' | 'offline'

export type ApiKeyState = {
  apiKey: string | null
  validationStatus: KeyValidationStatus
  validatedAt: number | null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const errorCode = (error: unknown): AiProviderError['code'] | null => {
  const rawCode: string | null = isRecord(error)
    ? typeof error.code === 'string'
      ? error.code
      : typeof error.message === 'string'
        ? error.message
        : null
    : typeof error === 'string'
      ? error
      : null
  if (rawCode === null) return null
  const code = rawCode.startsWith('AiProviderError: ')
    ? rawCode.slice('AiProviderError: '.length)
    : rawCode
  return code === 'missing_key' ||
    code === 'invalid_key' ||
    code === 'quota_exhausted' ||
    code === 'rate_limited' ||
    code === 'offline' ||
    code === 'timeout' ||
    code === 'invalid_response' ||
    code === 'unknown'
    ? code
    : null
}

const parseState = (value: unknown): ApiKeyState => {
  if (
    !isRecord(value) ||
    typeof value.apiKey !== 'string' ||
    value.apiKey.length === 0 ||
    (value.validationStatus !== 'unchecked' &&
      value.validationStatus !== 'valid' &&
      value.validationStatus !== 'invalid' &&
      value.validationStatus !== 'offline') ||
    (value.validatedAt !== null && typeof value.validatedAt !== 'number')
  ) {
    return { apiKey: null, validationStatus: 'missing', validatedAt: null }
  }
  return {
    apiKey: value.apiKey,
    validationStatus: value.validationStatus,
    validatedAt: value.validatedAt,
  }
}

export const aiErrorMessage = (error: unknown): string => {
  const code = errorCode(error)
  if (code === null) {
    return 'Не удалось получить перевод. Попробуйте ещё раз.'
  }
  switch (code) {
    case 'missing_key':
      return 'Добавьте Gemini API key в настройках.'
    case 'invalid_key':
      return 'API key недействителен. Проверьте ключ в настройках.'
    case 'quota_exhausted':
      return 'Квота AI API исчерпана. Проверьте лимиты вашего аккаунта.'
    case 'rate_limited':
      return 'Слишком много запросов. Попробуйте ещё раз через некоторое время.'
    case 'offline':
      return 'Нет подключения к интернету. Сохранённые переводы по-прежнему доступны.'
    case 'timeout':
      return 'Сервис перевода отвечает слишком долго. Попробуйте позже.'
    case 'invalid_response':
    case 'unknown':
      return 'Не удалось получить перевод. Попробуйте ещё раз.'
  }
}

export class ApiKeyService {
  constructor(
    private readonly db: OctaReaderDatabase = database,
    private readonly provider: Pick<AiProvider, 'validateKey'> = geminiProvider,
  ) {}

  async getState(): Promise<ApiKeyState> {
    return parseState((await this.db.settings.get(API_KEY_SETTING_KEY))?.value)
  }

  private async putState(state: ApiKeyState): Promise<void> {
    const record: Setting = {
      key: API_KEY_SETTING_KEY,
      value: state,
      updatedAt: Date.now(),
    }
    await this.db.settings.put(record)
  }

  async save(apiKey: string): Promise<ApiKeyState> {
    const normalizedKey = apiKey.trim()
    if (normalizedKey.length === 0) throw new AiProviderError('missing_key')
    const state: ApiKeyState = {
      apiKey: normalizedKey,
      validationStatus: 'unchecked',
      validatedAt: null,
    }
    await this.putState(state)
    return state
  }

  async delete(): Promise<void> {
    await this.db.settings.delete(API_KEY_SETTING_KEY)
  }

  async validate(apiKey?: string): Promise<ApiKeyState> {
    const state =
      apiKey === undefined ? await this.getState() : await this.save(apiKey)
    if (state.apiKey === null) throw new AiProviderError('missing_key')
    const validatedKey = state.apiKey
    const outcome = await Promise.resolve()
      .then(() => this.provider.validateKey(validatedKey))
      .then(
        () => ({ ok: true as const }),
        (error: unknown) => ({ ok: false as const, error }),
      )
    if (outcome.ok) {
      const valid: ApiKeyState = {
        ...state,
        validationStatus: 'valid',
        validatedAt: Date.now(),
      }
      await this.putState(valid)
      return valid
    }
    const code = errorCode(outcome.error)
    if (code === 'invalid_key' || code === 'offline') {
      const checked: ApiKeyState = {
        ...state,
        validationStatus: code === 'invalid_key' ? 'invalid' : 'offline',
        validatedAt: Date.now(),
      }
      await this.putState(checked)
      return checked
    }
    throw outcome.error
  }

  async keyForTranslation(): Promise<string> {
    const state = await this.getState()
    if (state.apiKey === null) throw new AiProviderError('missing_key')
    if (state.validationStatus === 'valid') return state.apiKey
    const checked = await this.validate()
    if (checked.validationStatus === 'invalid') {
      throw new AiProviderError('invalid_key')
    }
    if (checked.validationStatus === 'offline') {
      throw new AiProviderError('offline')
    }
    if (checked.apiKey === null) throw new AiProviderError('missing_key')
    return checked.apiKey
  }
}

export const apiKeyService = new ApiKeyService()

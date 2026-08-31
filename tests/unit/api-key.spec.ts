import 'fake-indexeddb/auto'

import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { OctaReaderDatabase } from '@/data/database'
import { AiProviderError } from '@/domain/ai/provider'
import { aiErrorMessage, ApiKeyService } from '@/domain/api-key'

const databaseNames: string[] = []
const createDatabase = (): OctaReaderDatabase => {
  const name = `api-key-test-${crypto.randomUUID()}`
  databaseNames.push(name)
  return new OctaReaderDatabase(name)
}

afterEach(async () => {
  await Promise.all(databaseNames.splice(0).map((name) => Dexie.delete(name)))
})

describe('ApiKeyService', () => {
  const validateKey = vi.fn()

  beforeEach(() => validateKey.mockReset().mockResolvedValue(undefined))

  it('stores and validates a key before first translation', async () => {
    const db = createDatabase()
    const service = new ApiKeyService(db, { validateKey })
    await service.save(' unit-test-credential ')
    await expect(service.keyForTranslation()).resolves.toBe(
      'unit-test-credential',
    )
    expect(validateKey).toHaveBeenCalledOnce()
    expect((await service.getState()).validationStatus).toBe('valid')
    db.close()
  })

  it('does not mark a key invalid when validation is offline', async () => {
    const db = createDatabase()
    const service = new ApiKeyService(db, {
      validateKey: () => Promise.reject(new AiProviderError('offline')),
    })
    const state = await service.validate('unit-test-credential')
    expect(state.validationStatus).toBe('offline')
    expect(state.apiKey).toBe('unit-test-credential')
    db.close()
  })

  it('marks a rejected credential invalid with no provider text', async () => {
    const db = createDatabase()
    const state = await new ApiKeyService(db, {
      validateKey: () => Promise.reject(new AiProviderError('invalid_key')),
    }).validate('unit-test-credential')
    expect(state.validationStatus).toBe('invalid')
    expect(aiErrorMessage(new AiProviderError('invalid_key'))).toBe(
      'API key недействителен. Проверьте ключ в настройках.',
    )
    db.close()
  })

  it('deletes only the credential setting and preserves translation cache', async () => {
    const db = createDatabase()
    const service = new ApiKeyService(db, { validateKey })
    await service.save('unit-test-credential')
    await db.translationCache.add({
      key: 'cache-key',
      normalizedSourceText: 'word',
      normalizedSentence: '',
      sourceLanguage: 'en',
      targetLanguage: 'ru',
      provider: 'gemini',
      model: 'configured-model',
      result: {},
      createdAt: 1,
    })
    await service.delete()
    expect((await service.getState()).validationStatus).toBe('missing')
    expect(await db.translationCache.get('cache-key')).toBeDefined()
    db.close()
  })
})

describe('AI error messages', () => {
  it.each([
    [
      'quota_exhausted',
      'Квота AI API исчерпана. Проверьте лимиты вашего аккаунта.',
    ],
    [
      'rate_limited',
      'Слишком много запросов. Попробуйте ещё раз через некоторое время.',
    ],
    [
      'offline',
      'Нет подключения к интернету. Сохранённые переводы по-прежнему доступны.',
    ],
    ['timeout', 'Сервис перевода отвечает слишком долго. Попробуйте позже.'],
    ['invalid_response', 'Не удалось получить перевод. Попробуйте ещё раз.'],
  ] as const)('maps %s to a sanitized Russian message', (code, message) => {
    expect(aiErrorMessage(new AiProviderError(code))).toBe(message)
    expect(message).not.toContain('unit-test-credential')
  })
})

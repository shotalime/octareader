import { describe, expect, it } from 'vitest'

import {
  LANGUAGE_SNAPSHOT,
  languageDisplayName,
  languageOptions,
  normalizeLanguageCode,
  SUPPORTED_LANGUAGE_CODES,
} from '@/domain/languages'

describe('supported translation languages', () => {
  it('keeps a versioned offline snapshot with canonical language codes', () => {
    expect(LANGUAGE_SNAPSHOT).toMatchObject({
      version: 1,
      verifiedAt: '2026-08-30',
    })
    expect(LANGUAGE_SNAPSHOT.source).toMatch(/^https:\/\/cloud\.google\.com\//u)
    expect(SUPPORTED_LANGUAGE_CODES.length).toBeGreaterThan(90)
    expect(new Set(SUPPORTED_LANGUAGE_CODES).size).toBe(
      SUPPORTED_LANGUAGE_CODES.length,
    )
    expect(SUPPORTED_LANGUAGE_CODES).toContain('zh-Hans')
    expect(SUPPORTED_LANGUAGE_CODES).toContain('zh-Hant')
    expect(SUPPORTED_LANGUAGE_CODES).toContain('he')
    expect(SUPPORTED_LANGUAGE_CODES).not.toContain('iw')
    expect(SUPPORTED_LANGUAGE_CODES).not.toContain('zh')
  })

  it.each([
    ['iw', 'he'],
    ['he-IL', 'he'],
    ['zh', 'zh-Hans'],
    ['zh_CN', 'zh-Hans'],
    ['zh-TW', 'zh-Hant'],
    ['nl-NL', 'nl'],
    ['MNI-mtei', 'mni-Mtei'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeLanguageCode(input)).toBe(expected)
  })

  it('returns null for an unsupported or empty metadata language', () => {
    expect(normalizeLanguageCode('')).toBeNull()
    expect(normalizeLanguageCode('xx-Zzzz')).toBeNull()
  })

  it('uses Russian display names and a safe fallback', () => {
    expect(languageDisplayName('de')).toMatch(/немец/u)
    expect(languageDisplayName('he', null)).toBe('Иврит')
    expect(languageDisplayName('af', null)).toBe('af')
    const brokenDisplayNames = {
      of: () => {
        throw new RangeError('unsupported language tag')
      },
    } as unknown as Intl.DisplayNames
    expect(languageDisplayName('zh-Hant', brokenDisplayNames)).toBe(
      'Китайский (традиционное письмо)',
    )
  })

  it('sorts options by their Russian labels', () => {
    const options = languageOptions()
    const collator = new Intl.Collator('ru')
    for (let index = 1; index < options.length; index += 1) {
      const previous = options[index - 1]
      const current = options[index]
      expect(previous).toBeDefined()
      expect(current).toBeDefined()
      expect(
        collator.compare(previous?.label ?? '', current?.label ?? ''),
      ).toBe(-1)
    }
  })
})

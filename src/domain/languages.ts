export const LANGUAGE_SNAPSHOT = Object.freeze({
  version: 1,
  verifiedAt: '2026-08-30',
  source:
    'https://cloud.google.com/vertex-ai/generative-ai/docs/learn/models#language_support',
})

// Offline snapshot of the languages Google documents for Gemini text models.
// Google's `iw` is stored as canonical BCP 47 `he`; its combined `zh` entry is
// represented by explicit Simplified and Traditional script variants.
export const SUPPORTED_LANGUAGE_CODES = [
  'af',
  'sq',
  'am',
  'ar',
  'hy',
  'as',
  'az',
  'eu',
  'be',
  'bn',
  'bs',
  'bg',
  'ca',
  'ceb',
  'zh-Hans',
  'zh-Hant',
  'co',
  'hr',
  'cs',
  'da',
  'dv',
  'nl',
  'en',
  'eo',
  'et',
  'fil',
  'fi',
  'fr',
  'fy',
  'gl',
  'ka',
  'de',
  'el',
  'gu',
  'ht',
  'ha',
  'haw',
  'he',
  'hi',
  'hmn',
  'hu',
  'is',
  'ig',
  'id',
  'ga',
  'it',
  'ja',
  'jv',
  'kn',
  'kk',
  'km',
  'ko',
  'kri',
  'ku',
  'ky',
  'lo',
  'la',
  'lv',
  'lt',
  'lb',
  'mk',
  'mg',
  'ms',
  'ml',
  'mt',
  'mi',
  'mr',
  'mni-Mtei',
  'mn',
  'my',
  'ne',
  'no',
  'ny',
  'or',
  'ps',
  'fa',
  'pl',
  'pt',
  'pa',
  'ro',
  'ru',
  'sm',
  'gd',
  'sr',
  'st',
  'sn',
  'sd',
  'si',
  'sk',
  'sl',
  'so',
  'es',
  'su',
  'sw',
  'sv',
  'tg',
  'ta',
  'te',
  'th',
  'tr',
  'uk',
  'ur',
  'ug',
  'uz',
  'vi',
  'cy',
  'xh',
  'yi',
  'yo',
  'zu',
] as const

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGE_CODES)[number]

export type LanguageOption = {
  code: SupportedLanguageCode
  label: string
}

const supportedCodes = new Map(
  SUPPORTED_LANGUAGE_CODES.map((code) => [code.toLocaleLowerCase(), code]),
)

const aliases: Readonly<Record<string, SupportedLanguageCode>> = {
  iw: 'he',
  in: 'id',
  ji: 'yi',
  zh: 'zh-Hans',
  'zh-cn': 'zh-Hans',
  'zh-sg': 'zh-Hans',
  'zh-tw': 'zh-Hant',
  'zh-hk': 'zh-Hant',
  'zh-mo': 'zh-Hant',
}

const fallbackLabels: Readonly<Partial<Record<SupportedLanguageCode, string>>> =
  {
    en: 'Английский',
    he: 'Иврит',
    ru: 'Русский',
    'zh-Hans': 'Китайский (упрощённое письмо)',
    'zh-Hant': 'Китайский (традиционное письмо)',
  }

export const normalizeLanguageCode = (
  value: string | null | undefined,
): SupportedLanguageCode | null => {
  const normalized = value?.normalize('NFKC').trim().replaceAll('_', '-')
  if (!normalized) return null
  const lower = normalized.toLocaleLowerCase()
  const alias = aliases[lower]
  if (alias !== undefined) return alias
  const exact = supportedCodes.get(lower)
  if (exact !== undefined) return exact
  const base = lower.split('-')[0]
  return base === undefined ? null : (supportedCodes.get(base) ?? null)
}

const createRussianDisplayNames = (): Intl.DisplayNames | null => {
  if (typeof Intl.DisplayNames !== 'function') return null
  try {
    return new Intl.DisplayNames(['ru'], { type: 'language' })
  } catch {
    return null
  }
}

export const languageDisplayName = (
  code: SupportedLanguageCode,
  displayNames: Intl.DisplayNames | null = createRussianDisplayNames(),
): string => {
  try {
    return displayNames?.of(code) ?? fallbackLabels[code] ?? code
  } catch {
    return fallbackLabels[code] ?? code
  }
}

export const languageOptions = (
  displayNames: Intl.DisplayNames | null = createRussianDisplayNames(),
  collator = new Intl.Collator('ru'),
): LanguageOption[] =>
  SUPPORTED_LANGUAGE_CODES.map((code) => ({
    code,
    label: languageDisplayName(code, displayNames),
  })).sort((left, right) => collator.compare(left.label, right.label))

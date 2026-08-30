import { resolve } from 'node:path'

import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const productionFile = resolve(process.cwd(), 'src/main.ts')
const testFile = resolve(process.cwd(), 'tests/unit/LibraryView.spec.ts')

const getRuleSeverity = (config: unknown, ruleName: string): unknown => {
  if (typeof config !== 'object' || config === null || !('rules' in config)) {
    throw new Error('ESLint вернул конфигурацию без правил')
  }

  const rules: unknown = config.rules

  if (typeof rules !== 'object' || rules === null) {
    throw new Error('ESLint вернул некорректную конфигурацию правил')
  }

  const setting = (rules as Record<string, unknown>)[ruleName]

  return Array.isArray(setting) ? setting[0] : setting
}

describe('ESLint production safeguards', () => {
  it('отклоняет опасные конструкции в production-коде', async () => {
    const eslint = new ESLint()
    const [result] = await eslint.lintText(
      `
        import { describe } from 'vitest'

        declare const payload: any
        const safeText: string = payload
        Promise.resolve('ignored')
        console.log(safeText)
        localStorage.setItem('key', 'value')
        window.sessionStorage.setItem('key', 'value')

        if (payload == null) {
          describe('unsafe', () => undefined)
        }
      `,
      { filePath: productionFile },
    )

    if (result === undefined) {
      throw new Error('ESLint не вернул результат для production fixture')
    }

    const ruleIds = new Set(result.messages.map(({ ruleId }) => ruleId))

    const expectedRuleIds = [
      '@typescript-eslint/no-explicit-any',
      '@typescript-eslint/no-floating-promises',
      '@typescript-eslint/no-unsafe-assignment',
      'eqeqeq',
      'import-x/no-extraneous-dependencies',
      'no-console',
      'no-restricted-globals',
      'no-restricted-imports',
      'no-restricted-syntax',
    ]

    for (const ruleId of expectedRuleIds) {
      expect(ruleIds).toContain(ruleId)
    }
  })

  it('ограничивает тестовый override каталогом тестов', async () => {
    const eslint = new ESLint()
    const productionConfig: unknown =
      await eslint.calculateConfigForFile(productionFile)
    const testConfig: unknown = await eslint.calculateConfigForFile(testFile)

    expect(getRuleSeverity(productionConfig, 'no-console')).toBe(2)
    expect(getRuleSeverity(testConfig, 'no-console')).toBe(0)
  })
})

import eslint from '@eslint/js'
import prettier from 'eslint-config-prettier'
import importX from 'eslint-plugin-import-x'
import vue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const typeCheckedFiles = ['**/*.{ts,tsx,vue}']
const testFiles = ['tests/**/*.{ts,tsx,vue}', '**/*.{spec,test}.{ts,tsx}']

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...vue.configs['flat/recommended'],
  {
    files: typeCheckedFiles,
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: ['.vue'],
        parser: tseslint.parser,
      },
    },
    rules: {
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports', prefer: 'type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          reportUsedIgnorePattern: true,
        },
      ],
      curly: ['error', 'all'],
      eqeqeq: ['error', 'always'],
      'vue/no-mutating-props': 'error',
      'vue/no-v-html': 'error',
    },
  },
  {
    files: ['src/**/*.{ts,tsx,vue}'],
    plugins: {
      'import-x': importX,
    },
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      'import-x/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: false,
          optionalDependencies: false,
          peerDependencies: false,
        },
      ],
      'no-console': 'error',
      'no-debugger': 'error',
      'no-restricted-globals': [
        'error',
        {
          name: 'localStorage',
          message:
            'Храните пользовательские данные через репозитории IndexedDB.',
        },
        {
          name: 'sessionStorage',
          message:
            'Храните пользовательские данные через репозитории IndexedDB.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'vitest',
              message: 'Тестовые модули нельзя импортировать в production-код.',
            },
            {
              name: '@vue/test-utils',
              message: 'Тестовые модули нельзя импортировать в production-код.',
            },
            {
              name: '@playwright/test',
              message: 'Тестовые модули нельзя импортировать в production-код.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[property.name='localStorage']",
          message:
            'Храните пользовательские данные через репозитории IndexedDB.',
        },
        {
          selector: "MemberExpression[property.name='sessionStorage']",
          message:
            'Храните пользовательские данные через репозитории IndexedDB.',
        },
      ],
    },
  },
  {
    files: testFiles,
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
  prettier,
)

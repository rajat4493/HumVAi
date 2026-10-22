import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // game-core must stay free of UI/DOM/network: enforced here, not by convention.
    files: ['packages/game-core/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-imports': ['error', { patterns: ['react*', 'phaser*', '@hva/web*'] }],
      'no-restricted-globals': ['error', 'window', 'document', 'fetch', 'localStorage'],
      'no-restricted-properties': ['error', { object: 'Math', property: 'random', message: 'Engine must be deterministic.' },
        { object: 'Date', property: 'now', message: 'Engine must be deterministic.' }],
    },
  },
  {
    // Browser-safe by construction: no Node built-ins, and the provider (network, API-key) code is never imported by the web app.
    files: ['packages/ai-adapters/src/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: ['node:*', 'fs', 'path', 'child_process', 'react*', 'phaser*'] }] },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-restricted-imports': ['error', { patterns: ['@hva/ai-adapters/providers', '@hva/runner*', 'node:*'] }],
      'no-restricted-properties': ['error', { object: 'process', property: 'env', message: 'API keys and env belong to the server-side runner only.' }],
    },
  },
  { files: ['apps/web/**/*.test.ts', 'apps/web/vite.config.ts'], languageOptions: { globals: globals.node }, rules: { 'no-restricted-imports': 'off' } }, // build-time and test-only Node code
  { files: ['**/*.{js,mjs}', 'tests/**/*.ts', 'playwright.config.ts', 'packages/game-core/scripts/**/*.ts', 'apps/runner/**/*.ts', 'packages/ai-adapters/test/**/*.ts', 'tools/**/*.mjs', 'tools/**/*.ts'], languageOptions: { globals: globals.node } },
);

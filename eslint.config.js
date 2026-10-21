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
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  { files: ['**/*.{js,mjs}', 'tests/**/*.ts', 'playwright.config.ts', 'packages/game-core/scripts/**/*.ts'], languageOptions: { globals: globals.node } },
);

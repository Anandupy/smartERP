import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';
import tsPlugin from '@typescript-eslint/eslint-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

/**
 * ESLint flat config — Next.js 15 + TypeScript.
 *
 * Uses FlatCompat to load next/core-web-vitals.
 * The "Next.js plugin not detected" build warning is cosmetic —
 * it does not fail compilation. All actual rule violations do.
 */
const eslintConfig = [
  // Next.js core rules (React, React Hooks, Next.js, import, accessibility)
  ...compat.extends('next/core-web-vitals'),

  // TypeScript rules — plugin declared in same config block as its rules
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      // warn not error — prevents build failure from library patterns
      '@typescript-eslint/no-non-null-assertion': 'warn',

      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
      'react/self-closing-comp': 'error',
    },
  },

  // Ignores
  {
    ignores: [
      '.next/**',
      'out/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'node_modules/**',
      '*.config.mjs',
      '*.config.ts',
      'src/tests/**',
    ],
  },
];

export default eslintConfig;

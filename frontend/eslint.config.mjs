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
 * Uses FlatCompat to extend next/core-web-vitals (handles React, hooks,
 * next.js rules). TypeScript plugin is explicitly declared here so
 * @typescript-eslint/* rules can be resolved.
 */
const eslintConfig = [
  // Next.js core rules (includes react, react-hooks, import, accessibility)
  ...compat.extends('next/core-web-vitals'),

  // TypeScript rules — plugin must be declared in the same config object
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
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // General quality
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],

      // React
      'react/self-closing-comp': 'error',
    },
  },

  // Global ignores
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

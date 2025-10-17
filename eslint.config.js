import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import jsdocPlugin from 'eslint-plugin-jsdoc';
import nPlugin from 'eslint-plugin-n';
import globals from 'globals';
import tsEslint from 'typescript-eslint';

export default [
  // --- Global Ignores ---
  {
    ignores: ['dist/', 'node_modules/', '.DS_Store'],
  },

  // --- Base JavaScript Configuration ---
  {
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    plugins: {
      n: nPlugin,
      import: importPlugin,
      jsdoc: jsdocPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: true,
        node: true,
        alias: {
          map: [['@', './src']],
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
      },
      jsdoc: {
        mode: 'typescript',
      },
    },
    rules: {
      ...nPlugin.configs['recommended-script'].rules,
      'no-var': 'error',
      'prefer-const': 'error',
      'require-jsdoc': 'off',
      'valid-jsdoc': 'off',
      'jsdoc/require-param': 'warn',
      'jsdoc/require-returns': 'warn',
      'n/no-unpublished-import': 'off',
    },
  },

  // --- TypeScript-Specific Configuration ---
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsEslint.parser,
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tsEslint.plugin,
      import: importPlugin,
      jsdoc: jsdocPlugin,
    },
    rules: {
      ...tsEslint.configs.recommendedTypeChecked[0].rules,

      // Code Structure & Complexity
      '@typescript-eslint/explicit-member-accessibility': [
        'error',
        {
          accessibility: 'explicit',
          overrides: { constructors: 'no-public' },
        },
      ],
      complexity: ['warn', 10],
      'no-console': 'off',

      // Stricter Typing & Code Style
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-magic-numbers': [
        'warn',
        {
          ignore: [-1, 0, 1],
          ignoreArrayIndexes: true,
          ignoreDefaultValues: true,
        },
      ],
      '@typescript-eslint/prefer-as-const': 'error',
      '@typescript-eslint/array-type': ['error', { default: 'generic' }],
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'typeParameter',
          format: ['PascalCase'],
          custom: { regex: '^(T|T[A-Z][A-Za-z]+)$', match: true },
        },
      ],

      // Security, Best Practices & Logic
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      '@typescript-eslint/strict-boolean-expressions': [
        'error',
        {
          allowNullableBoolean: true,
          allowNullableObject: true,
          allowNullableString: false,
        },
      ],

      // Immutability, Safety & Performance
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',

      // Import Organization & Style
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],

      // Overridden Defaults
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-empty-function': 'off',

      // Disable node plugin import rules for TS files
      'n/no-missing-import': 'off',
      'n/no-missing-require': 'off',
      'n/no-extraneous-import': 'off',
      'n/no-process-exit': 'off',
      'n/hashbang': 'off',
    },
  },

  // --- Jest/Test File Overrides ---
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
    rules: {
      'max-lines-per-function': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },

  // --- Prettier: MUST be last to override other configs ---
  prettierConfig,
];

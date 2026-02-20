const path = require('node:path');

const resolveFromFrontend = (pkg) => require.resolve(pkg, { paths: [path.join(__dirname, 'frontend')] });

module.exports = {
  root: true,
  env: {
    es2022: true,
    node: true,
  },
  parser: resolveFromFrontend('@typescript-eslint/parser'),
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  settings: {},
  ignorePatterns: [
    '**/dist/**',
    '**/coverage/**',
    '**/node_modules/**',
    '**/*.d.ts',
    'frontend/public/**',
    'backend/prisma/**',
  ],
  rules: {
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'prefer-const': 'error',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'sort-imports': ['warn', { ignoreCase: true, ignoreDeclarationSort: false }],
    '@typescript-eslint/no-explicit-any': 'off',
    'no-case-declarations': 'off',
  },
  overrides: [
    {
      files: ['frontend/**/*.{ts,tsx}'],
      env: {
        browser: true,
      },
      plugins: ['react-hooks', 'react-refresh'],
      extends: ['plugin:react-hooks/recommended'],
      rules: {
        'react-refresh/only-export-components': 'off',
      },
    },
    {
      files: ['**/*.{test,spec}.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}'],
      rules: {
        'no-console': 'off',
      },
    },
  ],
};

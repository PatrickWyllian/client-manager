module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'commonjs'
  },
  rules: {
    'indent': ['error', 2],
    'linebreak-style': ['error', 'unix'],
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-console': 'off',
    'no-undef': 'error',
    'no-unreachable': 'error',
    'eqeqeq': ['error', 'always'],
    'no-trailing-spaces': 'error',
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
    'comma-dangle': ['error', 'always-multiline'],
    'prefer-const': 'warn',
    'no-var': 'error',
    'prefer-arrow-callback': 'warn',
    'arrow-spacing': ['error', { before: true, after: true }],
    'no-multi-spaces': 'warn',
    'key-spacing': ['error', { beforeColon: false, afterColon: true }],
    'block-spacing': ['error', 'always'],
    'space-before-function-paren': ['error', { anonymous: 'always', named: 'never' }],
    'space-infix-ops': 'warn',
    'keyword-spacing': 'warn',
    'space-unary-ops': 'warn',
    'no-duplicate-imports': 'warn',
    'no-useless-return': 'warn',
    'no-empty-function': 'warn',
    'no-shadow': ['warn', { builtinGlobals: true, hoist: 'functions', allow: ['err', 'error', 'next', 'req', 'res'] }],
    'no-param-reassign': ['warn', { props: true, ignorePropertyModificationsFor: ['req', 'res', 'next'] }],
    'no-return-await': 'warn',
    'require-await': 'warn'
  },
  overrides: [
    {
      files: ['__tests__/**/*.test.js'],
      env: {
        jest: true
      },
      rules: {
        'no-unused-vars': 'off',
        'no-shadow': 'off'
      }
    }
  ]
};
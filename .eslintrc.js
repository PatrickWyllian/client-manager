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
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': 'off',
    'no-undef': 'error',
    'no-unreachable': 'error',
    'eqeqeq': ['error', 'always'],
    'no-trailing-spaces': 'error',
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
    'comma-dangle': ['error', 'always-multiline'],
    'prefer-const': 'error',
    'no-var': 'error',
    'prefer-arrow-callback': 'error',
    'arrow-spacing': ['error', { before: true, after: true }],
    'no-multi-spaces': 'error',
    'key-spacing': ['error', { beforeColon: false, afterColon: true }],
    'block-spacing': ['error', 'always'],
    'space-before-function-paren': ['error', { anonymous: 'always', named: 'never' }],
    'space-infix-ops': 'error',
    'keyword-spacing': 'error',
    'space-unary-ops': 'error',
    'no-duplicate-imports': 'error',
    'no-useless-return': 'error',
    'no-empty-function': 'warn',
    'no-shadow': ['error', { builtinGlobals: true, hoist: 'functions', allow: ['err', 'error', 'next', 'req', 'res'] }],
    'no-param-reassign': ['error', { props: true, ignorePropertyModificationsFor: ['req', 'res', 'next'] }],
    'no-return-await': 'error',
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
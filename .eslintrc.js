module.exports = {
    env: {
        browser: true,
        es2021: true,
        webextensions: true
    },
    extends: [
        'eslint:recommended'
    ],
    parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module'
    },
    rules: {
        // Enforce proper spacing
        'space-infix-ops': 'error',
        'no-multi-spaces': 'error',

        // Optional chaining specific rules
        'no-whitespace-before-property': 'error',
        'computed-property-spacing': ['error', 'never'],

        // General code quality
        'no-unused-vars': 'warn',
        'no-console': 'off', // Allow console for Chrome extension development
        'indent': ['error', 4],
        'quotes': ['error', 'single'],
        'semi': ['error', 'always']
    },
    globals: {
        chrome: 'readonly'
    }
};

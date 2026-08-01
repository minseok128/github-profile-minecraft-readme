import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: [
            'coverage/**',
            'dist/**',
            'node_modules/**',
            'output/**',
            'profile/**',
        ],
    },
    {
        files: ['**/*.js'],
        ...eslint.configs.recommended,
    },
    {
        files: ['src/**/*.ts'],
        extends: [
            eslint.configs.recommended,
            ...tseslint.configs.recommendedTypeChecked,
        ],
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            '@typescript-eslint/explicit-function-return-type': 'error',
            '@typescript-eslint/no-confusing-void-expression': 'off',
            '@typescript-eslint/no-misused-promises': [
                'error',
                { checksVoidReturn: false },
            ],
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-argument': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-return': 'off',
        },
    },
    {
        files: ['src/__tests__/**/*.ts'],
        rules: {
            '@typescript-eslint/no-base-to-string': 'off',
            '@typescript-eslint/require-await': 'off',
        },
    },
    {
        files: ['vitest.config.ts'],
        extends: [eslint.configs.recommended, ...tseslint.configs.recommended],
    },
);

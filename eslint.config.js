import tseslint from 'typescript-eslint';
export default tseslint.config({ ignores: ['node_modules/**', 'web/dist/**', '**/.wrangler/**'] }, ...tseslint.configs.recommended);

import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      '**/.next/**',
      '**/coverage/**',
      'generated/**',
      '**/node_modules/**',
      '**/dist/**',
      'apps/web/next-env.d.ts',
    ],
  },
  { languageOptions: { globals: { console: 'readonly' } } },
  js.configs.recommended,
  ...tseslint.configs.recommended,
];

import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts', 'src/lsp.ts'],
  format: ['cjs'],
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: true,
  external: [/novast-core/],
});

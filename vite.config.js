import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const isProduction = mode === 'production';
  return {
    plugins: [svelte()],
    /** hydra-synth's bundled dependencies reference the Node global object. */
    define: { global: 'globalThis' },
    base: isProduction ? '/muesli/' : '/',
    build: {
      outDir: 'docs',
      target: 'es2020', // Set the target environment here
      minify: isProduction,
    },
    /** Other folders (plan references under .claude/) can hold test files that must not run. */
    test: { include: ['test/**/*.test.ts'] },
  };
});

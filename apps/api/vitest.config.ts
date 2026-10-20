import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // SWC conserva los metadatos de decoradores que necesita la inyección de Nest.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  // `@chartsia/core` se usa desde sus fuentes (condición "@chartsia/source"), sin compilar antes.
  resolve: { conditions: ['@chartsia/source'] },
  ssr: { resolve: { conditions: ['@chartsia/source'], externalConditions: ['@chartsia/source'] } },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20_000,
    server: { deps: { inline: [/@chartsia\/core/] } },
  },
});

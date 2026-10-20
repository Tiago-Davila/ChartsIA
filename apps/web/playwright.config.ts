import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3390);
const dataDir = process.env.E2E_DATA_DIR ?? `/tmp/chartsia-e2e-${PORT}`;

/**
 * E2E con el hub real levantado por `webServer`, sirviendo la app compilada: se prueba el
 * modo de un solo proceso (viewUrl → /d/:id) igual que en producción.
 */
export default defineConfig({
  testDir: 'test/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: `rm -rf ${dataDir} && pnpm --filter @chartsia/core --filter @chartsia/api build && vite build && node ../api/dist/main.js`,
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      CHARTSIA_PORT: String(PORT),
      CHARTSIA_DATA_DIR: dataDir,
      CHARTSIA_PUBLIC_URL: `http://127.0.0.1:${PORT}`,
    },
  },
});

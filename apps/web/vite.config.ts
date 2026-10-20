import react from '@vitejs/plugin-react';
import { defaultClientConditions, defineConfig } from 'vite';

const hub = `http://127.0.0.1:${process.env.CHARTSIA_PORT ?? 3333}`;

export default defineConfig({
  plugins: [react()],
  // `@chartsia/core` se consume desde sus fuentes, sin compilarlo antes.
  resolve: { conditions: ['@chartsia/source', ...defaultClientConditions] },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': hub,
      '/mcp': hub,
      // Socket.IO: el namespace /live viaja por el path de transporte /socket.io.
      '/socket.io': { target: hub, ws: true },
    },
  },
  build: { target: 'es2023', sourcemap: true },
});

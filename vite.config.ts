import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { createReadStream, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const DATA_DIR = join(fileURLToPath(import.meta.url), '..', 'data');

// Middleware that serves data/ as /db/ — shared between dev and preview servers.
function dbMiddleware(middlewares: any) {
  middlewares.use('/db', (req: any, res: any, next: any) => {
    const url = (req.url ?? '/').replace(/\?.*$/, '');
    const file = join(DATA_DIR, url);
    try {
      const stat = statSync(file);
      if (!stat.isFile()) return next();
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      (createReadStream(file) as any).pipe(res);
    } catch {
      next();
    }
  });
}

const COI_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'serve-db',
      configureServer(server) { dbMiddleware(server.middlewares); },
      configurePreviewServer(server) { dbMiddleware(server.middlewares); },
    },
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectManifest: {
        // Include all assets; WASM files can be large, raise the limit.
        globPatterns: ['**/*.{js,css,html,wasm,svg,ico}'],
        // Never precache the database — OPFS handles it.
        globIgnores: ['**/bcv.db', '**/bible-nau.db', '**/bcv-lsj.db'],
        maximumFileSizeToCacheInBytes: 50_000_000,
      },
      manifest: {
        name: 'BibleSearch',
        short_name: 'BibleSearch',
        theme_color: '#1a2744',
        background_color: '#f5efe0',
        display: 'standalone',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    host: true,
    headers: COI_HEADERS,
  },
  preview: {
    host: true,
    headers: COI_HEADERS,
  },
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
});

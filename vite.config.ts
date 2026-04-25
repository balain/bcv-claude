import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createReadStream, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const DATA_DIR = join(fileURLToPath(import.meta.url), '..', 'data');

export default defineConfig({
  plugins: [
    react(),
    // Serve data/ as /db/ in dev without copying 130 MB into public/
    {
      name: 'serve-db',
      configureServer(server) {
        server.middlewares.use('/db', (req, res, next) => {
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
      },
    },
  ],
  server: {
    host: true,   // bind to 0.0.0.0 so other devices on the network can connect
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
});

import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';
import { resolvePublicFile } from './scripts/public-raw.js';

// Dev uniquement : sert /ort et /models bruts depuis public/ (Vite refuse d'importer des .mjs de public/).
const servePublicRaw = () => ({
  name: 'serve-public-raw',
  configureServer(server) {
    const types = { '.mjs': 'application/javascript', '.js': 'application/javascript', '.wasm': 'application/wasm', '.json': 'application/json', '.onnx': 'application/octet-stream', '.bin': 'application/octet-stream' };
    server.middlewares.use((req, res, next) => {
      const file = resolvePublicFile(server.config.publicDir, req.url || '');
      if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return next();
      res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      fs.createReadStream(file).pipe(res);
    });
  },
});

export default defineConfig(({ mode }) => ({
  resolve: { alias: { phonemizer: path.resolve(process.cwd(), 'src/lib/g2p.js') } },
  optimizeDeps: { exclude: ['@huggingface/transformers'] },
  plugins: [
    servePublicRaw(),
    ...(mode === 'https' ? [basicSsl()] : []),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        globIgnores: ['**/*.wasm', 'models/**', 'ort/**', 'espeak/**'],
        maximumFileSizeToCacheInBytes: 200 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\/models\//.test(url.pathname) || /\/ort\//.test(url.pathname) || /\/espeak\//.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'textatrou-voice',
              expiration: { maxEntries: 20 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'TEXTATROU',
        short_name: 'TEXTATROU',
        lang: 'fr',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#FFD166',
        background_color: '#FFFDF7',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/unit/**/*.test.{js,jsx}', 'tests/integration/**/*.test.{js,jsx}'],
  },
}));

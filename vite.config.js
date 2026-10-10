import { defineConfig } from 'vite';
import { stickerApi } from './server/api.js';

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/3dStickerTool/' : '/',
  define: { __STATIC_DEMO__: JSON.stringify(process.env.GITHUB_PAGES === 'true') },
  worker: { format: 'es' },
  plugins: [{ name: 'sticker-api', configureServer(server) { server.middlewares.use(stickerApi); } }],
});

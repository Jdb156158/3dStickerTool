import { defineConfig } from 'vite';
import { stickerApi } from './server/api.js';

export default defineConfig({
  worker: { format: 'es' },
  plugins: [{ name: 'sticker-api', configureServer(server) { server.middlewares.use(stickerApi); } }],
});

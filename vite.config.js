import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { requestHandler } from './dev-server.js';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'cv-api-dev-server',
      configureServer(server) {
        console.log('[cv-api-dev-server] API middleware loaded');

        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith('/api/')) {
            console.log('[cv-api-dev-server]', req.method, req.url);
            requestHandler(req, res);
            return;
          }

          next();
        });
      },
    },
  ],
});
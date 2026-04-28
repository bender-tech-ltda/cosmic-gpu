import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In dev we proxy `/v1/...`, `/health`, and `/metrics` to the backend so the
// frontend can use same-origin URLs and inherit cookies / CORS-free behaviour.
// `VITE_BACKEND_URL` overrides this per-deployment (e.g. for the live demo).
const BACKEND = process.env.VITE_BACKEND_URL ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/v1': { target: BACKEND, changeOrigin: true },
      '/health': { target: BACKEND, changeOrigin: true },
      '/metrics': { target: BACKEND, changeOrigin: true },
      '/docs': { target: BACKEND, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2022',
  },
});

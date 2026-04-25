import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Forward agent gateway calls to avoid CORS during dev
      '/intent': 'http://localhost:8000',
      '/api': 'http://localhost:3001',
    },
  },
});

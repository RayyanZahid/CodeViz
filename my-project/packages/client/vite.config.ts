import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/ws': {
        target: 'http://localhost:3100',
        ws: true,
        changeOrigin: false,
      },
      '/api': {
        target: 'http://localhost:3100',
        changeOrigin: false,
      },
    },
  },
});

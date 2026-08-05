import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.NODE_ENV === 'production'
    ? 'https://advitiyansstack-advitiyansfrontendbucketb4592ef5-e2ajahjiz5w3.s3.ap-south-1.amazonaws.com/'
    : './',
  plugins: [react()],
  define: {
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify(process.env.VITE_API_BASE_URL || 'https://w8tlnuswea.execute-api.ap-south-1.amazonaws.com/prod'),
    global: 'window',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { advisorsPlugin } from './vite-plugins/advisors';
import { devApiPlugin } from './vite-plugins/dev-api';

export default defineConfig(() => ({
  plugins: [react(), tailwindcss(), advisorsPlugin(), devApiPlugin()],
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
  },
}));

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  // Set VITE_BASE=/beadify-it/ when building for a subpath deployment.
  // Leave unset (or /) for standalone Vercel deploys and local dev.
  base: process.env.VITE_BASE ?? '/',

  server: {
    proxy: {
      '/process':       'http://localhost:8000',
      '/process-multi': 'http://localhost:8000',
      '/palette':       'http://localhost:8000',
      '/progress':      'http://localhost:8000',
      '/export':        'http://localhost:8000',
      '/uploads':       'http://localhost:8000',
    },
  },

  build: {
    outDir: 'dist',
  },
})

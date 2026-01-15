import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Base path for GitHub Pages deployment
  // Set via environment variable: VITE_BASE_PATH=/your-repo-name/
  // For local development, leave empty or use '/'
  base: process.env.VITE_BASE_PATH || '/',
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './src/main.tsx'
      },
      output: {
        entryFileNames: 'react-tabs.js',
        format: 'iife',
        name: 'ReactTabs'
      }
    }
  }
})

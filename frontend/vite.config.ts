import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  base: '/',
  define: {
    // Make env variables available
    'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || 'https://vnpt-ai-hackathon-meetmate.onrender.com'),
  },
  optimizeDeps: {
    include: ['simplex-noise'],
  },
})
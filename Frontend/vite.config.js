import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const devApiProxyTarget = process.env.VITE_DEV_API_PROXY_TARGET || 'http://localhost:8000'
const basePath = process.env.VITE_BASE_PATH || '/'

export default defineConfig({
  base: basePath,
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: devApiProxyTarget,
        changeOrigin: true,
      },
    },
  },
})

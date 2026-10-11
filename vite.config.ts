import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    const apiOrigin = loadEnv(mode, process.cwd(), 'VITE_').VITE_API_BASE_URL?.trim()
    let parsed: URL
    try {
      parsed = new URL(apiOrigin || '')
    } catch {
      throw new Error('VITE_API_BASE_URL must be the backend HTTPS origin for production builds')
    }
    if (parsed.protocol !== 'https:' || parsed.origin !== apiOrigin) {
      throw new Error('VITE_API_BASE_URL must be the backend HTTPS origin for production builds')
    }
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  }
})

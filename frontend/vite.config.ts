import { defineConfig, loadEnv } from 'vite'
import type { UserConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"
import mkcert from 'vite-plugin-mkcert'

// https://vite.dev/config/
export default defineConfig(({ mode }): UserConfig => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');
  const useHttps = env.VITE_USE_HTTPS === 'true';

  return {
    server: {
      https: (useHttps ? true : undefined) as any,
      proxy: {
        '/api/data': {
          target: 'http://localhost:8081',
          changeOrigin: true,
        }
      }
    },
    plugins: [
      react(),
      ...(useHttps ? [mkcert() as any] : [])
    ],
    build: {
      minify: false,
      chunkSizeWarningLimit: 2000,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  }
})

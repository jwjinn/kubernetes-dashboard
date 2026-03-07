import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"
import mkcert from 'vite-plugin-mkcert'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');
  const useHttps = env.VITE_USE_HTTPS === 'true';

  return {
    server: {
      https: useHttps,
    },
    plugins: [
      react(),
      ...(useHttps ? [mkcert()] : [])
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

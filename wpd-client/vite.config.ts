import fs from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    https: {
      key: fs.readFileSync(new URL('./certs/localhost.key', import.meta.url)),
      cert: fs.readFileSync(new URL('./certs/localhost.pem', import.meta.url)),
    },
    host: 'localhost',
    hmr: {
      protocol: 'wss',
      host: 'localhost',
      clientPort: 5173,
    },
    port: 5173,
    strictPort: true,
  },
})
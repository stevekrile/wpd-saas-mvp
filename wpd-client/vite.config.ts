import fs from 'node:fs'
import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
const keyPath = new URL('./certs/localhost.key', import.meta.url)
const certPath = new URL('./certs/localhost.pem', import.meta.url)
const hasLocalCerts = fs.existsSync(keyPath) && fs.existsSync(certPath)

export default defineConfig({
  plugins: [react(), ...(!hasLocalCerts ? [basicSsl()] : [])],
  server: {
    https: hasLocalCerts
      ? {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath),
        }
      : undefined,
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
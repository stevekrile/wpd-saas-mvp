import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    host: 'localhost',
    https: {},
    hmr: {
      protocol: 'wss',
      host: 'localhost',
      clientPort: 5173,
    },
    port: 5173,
    strictPort: true,
  },
})
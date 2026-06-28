import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { papersmithApiPlugin } from './server/papersmithApiPlugin.js'

export default defineConfig({
  plugins: [react(), papersmithApiPlugin()],
  server: {
    host: '127.0.0.1',
    port: Number(process.env.PAPERSMITH_PORT ?? 43227)
  },
  test: {
    environment: 'jsdom',
    include: ['tests/server/**/*.test.js', 'tests/src/**/*.test.js', 'tests/src/**/*.test.jsx'],
    setupFiles: ['./tests/setup.js']
  }
})

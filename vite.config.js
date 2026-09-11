import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Honour PORT when a launcher assigns one, rather than silently picking the
  // next free port and leaving the launcher pointed at the wrong address.
  server: process.env.PORT ? { port: Number(process.env.PORT), strictPort: true } : {},
})

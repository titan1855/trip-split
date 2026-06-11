/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// base 必須是 '/<repo名稱>/',改 repo 名稱要同步改這裡(CLAUDE.md 鐵則)
export default defineConfig({
  base: '/trip-split/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '旅行拆帳',
        short_name: '拆帳',
        display: 'standalone',
        theme_color: '#0d9488',
        background_color: '#ffffff',
        // 圖示於 Phase 4 補上
        icons: [],
      },
    }),
  ],
  test: {
    environment: 'node',
  },
})

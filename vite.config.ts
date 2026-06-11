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
        description: '跟旅伴一起記帳,回來算一下誰欠誰',
        lang: 'zh-Hant',
        display: 'standalone',
        theme_color: '#0d9488',
        background_color: '#f0fdfa',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
  },
})

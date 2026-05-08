import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Dog Weight Monitoring',
        short_name: 'DogWeight',
        description: "Track your dog's weight and compare with breed standards",
        theme_color: '#2563eb',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: ['**/OneSignalSDK*'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.thedogapi\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'dog-api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 86400 * 7 }
            }
          }
        ]
      }
    })
  ]
})

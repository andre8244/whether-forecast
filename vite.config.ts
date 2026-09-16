import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * GitHub Pages serves a project site from a subdirectory, so every asset,
 * the manifest and the service worker scope have to be prefixed with it.
 *
 * It is applied in development too. Running dev at `/` while production runs
 * under a prefix is exactly how base-path bugs reach the deploy unnoticed.
 */
const BASE = '/whether-forecast/'

export default defineConfig({
  base: BASE,
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Whether Forecast — previsioni e rischio temporali',
        short_name: 'Whether',
        description:
          'Previsioni meteo in unità metriche con temperatura percepita e probabilità di temporale da ensemble multi-modello.',
        lang: 'it',
        theme_color: '#0b1220',
        background_color: '#0b1220',
        display: 'standalone',
        id: BASE,
        start_url: BASE,
        scope: BASE,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            // A live network wins; a dead one falls back to the cached response.
            urlPattern: /^https:\/\/(api|ensemble-api|air-quality-api|geocoding-api)\.open-meteo\.com\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'open-meteo',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    globals: false,
    // Fixtures pair API local-time strings with an explicit UTC offset, so the
    // machine's own zone must not enter into it.
    env: { TZ: 'UTC' },
  },
})

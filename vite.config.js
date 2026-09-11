import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Installable app (PWA).
 *
 * The caching policy is the part that matters, because a sports app can lie
 * with a service worker without meaning to:
 *
 *   - Live scores (ESPN, EuroLeague) are NEVER cached. A score served from
 *     cache while offline looks exactly like a fresh one, and "Updated 3s
 *     ago" would be reporting when the cache answered, not when the game
 *     did. Offline, the app says it is offline instead.
 *   - Snapshot files (/data/*.json) are cached stale-while-revalidate. They
 *     are snapshots by nature and each carries its own `fetchedAt`, so an
 *     older copy is still honest about its age.
 *   - The app shell, fonts, crests and headshots are cached, because none of
 *     them change what a reader is told.
 */
const LIVE_API = [
  /^https:\/\/site\.api\.espn\.com\//,
  /^https:\/\/feeds\.incrowdsports\.com\//,
  /^https:\/\/api-live\.euroleague\.net\//,
]

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // "prompt" rather than "autoUpdate": a new version waits for the reader
      // to accept it instead of reloading the page out from under an article.
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
        name: 'Hoopspire — Heritage of the Hardwood',
        short_name: 'Hoopspire',
        description:
          'Scores, standings, rosters and stats across thirteen basketball leagues, from Manila to Madrid to São Paulo.',
        theme_color: '#1A1A1A',
        background_color: '#F3EFE7',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        categories: ['sports', 'news'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        // Long-press shortcuts on Android.
        shortcuts: [
          { name: 'Scores', url: '/scores', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
          { name: 'Stats', url: '/stats', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
          {
            name: 'The Margin',
            url: '/margin',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Client-side routes resolve to the app shell offline — except the
        // git-based CMS, which is its own page and must never be hijacked.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/admin/],
        runtimeCaching: [
          ...LIVE_API.map((urlPattern) => ({ urlPattern, handler: 'NetworkOnly' })),
          {
            urlPattern: ({ url }) =>
              url.origin === self.location.origin && url.pathname.startsWith('/data/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'snapshots', expiration: { maxEntries: 40 } },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'font-css' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'font-files',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Crests, headshots and article images from the leagues' CDNs.
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  // Honour PORT when a launcher assigns one, rather than silently picking the
  // next free port and leaving the launcher pointed at the wrong address.
  server: process.env.PORT ? { port: Number(process.env.PORT), strictPort: true } : {},
})

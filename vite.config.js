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
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'pwa-192x192.png'],
      manifest: {
        name: 'Hoopspire — Heritage of the Hardwood',
        short_name: 'Hoopspire',
        description:
          'Scores, standings, rosters and stats across thirteen basketball leagues, from Manila to Madrid to São Paulo.',
        theme_color: '#13233B',
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
          {
            name: 'Free Minutes',
            url: '/free-minutes',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        /*
          The full crest is a large-format asset — a social card, an app icon
          source — and no page renders it. Left in the glob above it more than
          doubled the precache, from 514 KiB to 1,184 KiB, so every first-time
          visitor downloaded 648 KB of artwork they would never be shown
          before the site could work offline.

          Excluding it here keeps the file served at its URL, which is all an
          og:image or an icon pipeline needs: those are fetched by crawlers
          and build steps, neither of which goes through a service worker.


          The league logos are left out for the same reason: fourteen PNGs,
          372 KB, of which a visitor sees the few on the front page. They load
          and cache like any image, and offline a card that cannot reach its
          logo falls back to the league's name.
        */
        /*
          index.html is left out of the precache on purpose. Articles are
          bundled into the app, so the HTML decides which bundle, and so which
          articles, a reader gets. A precached shell answered every navigation
          with the bundle from the reader's last visit: a link to a story
          published since then opened "That story isn't in the ledger" until
          the update prompt came round (2026-10-20, the 76ers-Knicks recap).
          Pages now come from the network first; see the navigation rule below.
        */
        globIgnores: [
          '**/logo/Hoopspire_logo.jpg',
          '**/logo/hoopspire-icon.png',
          '**/logo/leagues/**',
          'index.html',
        ],
        // vite-plugin-pwa adds a NavigationRoute to index.html unless told not
        // to, and it would run before the network-first rule below.
        navigateFallback: null,
        runtimeCaching: [
          {
            // Network first for pages, so the HTML and the bundle it names are
            // always current. A copy is kept for offline use, and if the
            // network fails or takes longer than 4 seconds the reader gets the
            // last copy of this page, or of the home page, which can route to
            // any client-side page itself.
            //
            // The CMS is its own page and the three crawler files are not pages
            // at all: typing /ads.txt into a browser is a *navigation*, so they
            // are left to the network untouched. Google's crawlers do not run
            // service workers, so this is not what makes AdSense lose an
            // ads.txt, but it is what makes you check the URL yourself, see a
            // basketball site, and misdiagnose which layer broke.
            urlPattern: ({ request, url }) =>
              request.mode === 'navigate' &&
              !/^\/(admin|ads\.txt$|robots\.txt$|sitemap\.xml$)/.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 60 },
              cacheableResponse: { statuses: [200] },
              plugins: [
                {
                  handlerDidError: async () => {
                    const pages = await caches.open('pages')
                    return (await pages.match('/')) || (await pages.keys().then((k) => (k[0] ? pages.match(k[0]) : undefined))) || Response.error()
                  },
                },
              ],
            },
          },
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

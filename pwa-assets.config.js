import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

/**
 * Generates every icon the install flow needs from public/icon.svg:
 * favicon.ico, the 64/192/512 PWA icons, a maskable 512 for Android's
 * adaptive icons, and the 180px apple-touch-icon iOS uses on the home screen.
 *
 *   npx pwa-assets-generator
 */
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    // The art already carries its own ink background; pad maskable and
    // Apple icons with the same ink so no white edge appears when cropped.
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: '#1A1A1A' } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: '#1A1A1A' } },
  },
  images: ['public/icon.svg'],
})

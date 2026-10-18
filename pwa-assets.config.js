import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

/**
 * Generates every icon the install flow needs from public/logo/hoopspire-icon.png
 * (a tight square crop of public/logo/Hoopspire_logo.jpg, so the mark stays
 * legible at 16px):
 * favicon.ico, the 64/192/512 PWA icons, a maskable 512 for Android's
 * adaptive icons, and the 180px apple-touch-icon iOS uses on the home screen.
 *
 *   npx pwa-assets-generator
 */
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    // The art carries its own navy background. Pad with the same navy: the
    // maskable icon needs room because Android crops it to a circle.
    maskable: { ...minimal2023Preset.maskable, padding: 0.3, resizeOptions: { background: '#051F44' } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: '#051F44' } },
  },
  images: ['public/logo/hoopspire-icon.png'],
})

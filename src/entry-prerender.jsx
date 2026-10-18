/**
 * Server entry for the build-time prerender (scripts/prerender.mjs).
 *
 * Renders the real app for one URL to a string, so the static HTML a crawler
 * reads before JavaScript is the same page the browser draws after it. Only
 * the prerender loads this file; the browser bundle never imports it.
 */
import React from 'react'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import App from './App.jsx'
import { getOriginals } from './lib/articles.js'
import { LEAGUES } from './lib/leagues.js'
import { SITE } from './lib/site.js'

export { SITE }
export { resolveMeta } from './lib/meta.js'

/** Every route worth putting in front of a crawler as finished HTML. */
export function routes() {
  return [
    '/',
    '/margin',
    '/free-minutes',
    '/press',
    '/opinion',
    '/heritage-line',
    '/archive',
    '/about',
    '/contact',
    '/privacy',
    '/terms',
    ...LEAGUES.map((l) => `/league/${l.slug}`),
    ...getOriginals().map((a) => a.href),
  ]
}

/** Render one URL. `meta` is whatever the page passed to useMeta. */
export function render(url) {
  const box = (globalThis.__HOOPSPIRE_META__ = { value: null })
  const html = renderToString(
    <StaticRouter location={url}>
      <App />
    </StaticRouter>
  )
  return { html, meta: box.value || {} }
}

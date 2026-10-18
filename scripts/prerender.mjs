/**
 * Writes finished HTML for every indexable route after `vite build`.
 *
 * Hoopspire is a single-page app, so without this every URL answers with the
 * same empty shell — a <div id="root"> and a script tag — and only shows its
 * writing once JavaScript runs. Googlebot runs it. Plenty of what judges a
 * site does not: a review pipeline that reads the raw HTML sees the cookie
 * banner and nothing else, and that is what "thin content" looks like.
 *
 * So the build renders the real app (src/entry-prerender.jsx, through Vite's
 * SSR loader so `import.meta.glob` and the Markdown imports work exactly as
 * they do in the browser) for each route, and writes it into a copy of the
 * built index.html with that page's own <title>, description and canonical.
 * The browser bundle is untouched: createRoot replaces the static markup with
 * the live app the moment it loads, so the site behaves as it always has.
 *
 * Files are written as /margin → dist/margin.html and /story/x →
 * dist/story/x.html. Cloudflare's asset server (html_handling
 * "auto-trailing-slash", the default) serves those at the clean URL with no
 * redirect; a dist/margin/index.html would instead redirect to /margin/ and
 * split every page across two addresses. The home page is index.html itself.
 *
 * Live-data routes (/scores, /stats, /teams, /team, /game, /player) are
 * noindex on purpose and stay client-only.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

/** Replace a head tag matched by `pattern`, or add it before </head>. */
function upsert(html, pattern, tag) {
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `    ${tag}\n  </head>`)
}

function head(shell, { fullTitle, desc, canonical }, { image, type = 'website', noindex }, siteName) {
  let html = shell.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(fullTitle)}</title>`)
  const tags = [
    [/<meta\s+name="description"[\s\S]*?\/>/, `<meta name="description" content="${esc(desc)}" />`],
    [/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${esc(canonical)}" />`],
    [/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(fullTitle)}" />`],
    [/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(desc)}" />`],
    [/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${esc(canonical)}" />`],
    [/<meta property="og:type"[^>]*>/, `<meta property="og:type" content="${esc(type)}" />`],
    [/<meta property="og:site_name"[^>]*>/, `<meta property="og:site_name" content="${esc(siteName)}" />`],
    [/<meta name="twitter:card"[^>]*>/, `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`],
    [/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${esc(fullTitle)}" />`],
    [/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${esc(desc)}" />`],
  ]
  if (image) {
    tags.push([/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${esc(image)}" />`])
    tags.push([/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${esc(image)}" />`])
  }
  if (noindex) tags.push([/<meta name="robots"[^>]*>/, `<meta name="robots" content="noindex, follow" />`])
  for (const [pattern, tag] of tags) html = upsert(html, pattern, tag)
  return html
}

/**
 * The static markup is for whoever reads the file without running it. The
 * service worker answers every navigation with the cached index.html — the
 * home page — so a returning reader opening /margin would see the front page
 * flash before the app drew the right one. This clears the markup first
 * whenever it was rendered for a different path than the one in the address
 * bar. It runs before the deferred app bundle, and only in a browser.
 */
const guard = (route) =>
  `<div id="root" data-route="${esc(route)}">`

const GUARD_SCRIPT =
  `<script>(function(){var r=document.getElementById('root');var p=decodeURIComponent(location.pathname).replace(/\\/+$/,'')||'/';if(r&&r.getAttribute('data-route')!==p)r.innerHTML=''})()</script>`

function body(html, route, markup) {
  if (!html.includes('<div id="root"></div>')) throw new Error('dist/index.html has no empty #root to fill')
  return html.replace('<div id="root"></div>', `${guard(route)}${markup}</div>\n    ${GUARD_SCRIPT}`)
}

function outFile(route) {
  return route === '/' ? join(dist, 'index.html') : join(dist, `${route.slice(1)}.html`)
}

const vite = await createServer({
  root,
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
})

let written = 0
let words = 0
try {
  const entry = await vite.ssrLoadModule('/src/entry-prerender.jsx')
  const shell = await readFile(join(dist, 'index.html'), 'utf8')

  for (const route of entry.routes()) {
    const { html: markup, meta } = entry.render(route)
    if (!meta.title && route !== '/') throw new Error(`${route} rendered without calling useMeta`)
    const resolved = entry.resolveMeta(meta, route)
    const page = body(head(shell, resolved, meta, entry.SITE.name), route, markup)

    const file = outFile(route)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, page, 'utf8')
    written++
    words += markup.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
  }
} finally {
  await vite.close()
}

console.log(`prerender — ${written} pages, ${Math.round(words / written)} words each on average`)

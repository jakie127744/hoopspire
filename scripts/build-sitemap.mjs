/**
 * Writes dist/sitemap.xml after a build.
 *
 * Only pages worth indexing go in. The live-data routes (/team/:id,
 * /game/:id, /player/:id) are deliberately absent: they are generated from
 * upstream feeds, they number in the thousands, and most of them are a table
 * that says 0–0 until a season starts. Listing them would hand a crawler a
 * very large pile of very thin pages, which is the opposite of what a site
 * under review wants.
 *
 * Article dates come from the Markdown frontmatter, so <lastmod> tells the
 * truth about when a piece was filed rather than when the build ran.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ORIGIN = 'https://hoopspire.com'

/** Static routes, with a rough sense of how often each actually changes. */
const STATIC = [
  { path: '/', changefreq: 'hourly', priority: '1.0' },
  { path: '/margin', changefreq: 'daily', priority: '0.9' },
  { path: '/free-minutes', changefreq: 'weekly', priority: '0.8' },
  { path: '/press', changefreq: 'daily', priority: '0.9' },
  { path: '/scores', changefreq: 'hourly', priority: '0.7' },
  { path: '/stats', changefreq: 'daily', priority: '0.7' },
  { path: '/teams', changefreq: 'weekly', priority: '0.6' },
  { path: '/about', changefreq: 'monthly', priority: '0.5' },
  { path: '/contact', changefreq: 'monthly', priority: '0.4' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.3' },
  { path: '/terms', changefreq: 'yearly', priority: '0.3' },
]

/** The desks, each a directory of Markdown under content/. */
const DESKS = ['articles', 'fantasy', 'news']

/** Pull one frontmatter field without dragging in a YAML parser. */
function field(raw, name) {
  const block = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!block) return null
  const line = block[1].match(new RegExp(`^${name}:\\s*(.+)$`, 'm'))
  return line ? line[1].trim().replace(/^["']|["']$/g, '') : null
}

async function articles() {
  const out = []
  for (const desk of DESKS) {
    let names = []
    try {
      names = await readdir(join(root, 'content', desk))
    } catch {
      continue // A desk with no directory yet is not an error.
    }
    for (const name of names) {
      // `_TEMPLATE.md` is scaffolding, not a page.
      if (!name.endsWith('.md') || name.startsWith('_')) continue
      const raw = await readFile(join(root, 'content', desk, name), 'utf8')
      // `draft: true` hides a piece from the site, so it must not be listed.
      if (field(raw, 'draft') === 'true') continue
      out.push({
        path: `/story/${field(raw, 'slug') || name.replace(/\.md$/, '')}`,
        lastmod: field(raw, 'published'),
        changefreq: 'monthly',
        priority: '0.8',
      })
    }
  }
  return out
}

const entry = ({ path, lastmod, changefreq, priority }) =>
  [
    '  <url>',
    `    <loc>${ORIGIN}${path}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ]
    .filter(Boolean)
    .join('\n')

const urls = [...STATIC, ...(await articles())]
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(entry).join('\n')}
</urlset>
`

await writeFile(join(root, 'dist', 'sitemap.xml'), xml, 'utf8')
console.log(`sitemap.xml — ${urls.length} URLs (${urls.length - STATIC.length} articles)`)

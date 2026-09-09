/**
 * Original articles — the writing that is actually yours.
 *
 * Posts live as Markdown files in /content/articles/*.md and are bundled at
 * build time by Vite, so there is no CMS, no database and no backend to run.
 * Add a file, and it appears on the site.
 *
 * This is the half of the site that makes it publishable. Aggregated
 * headlines are a service; original reporting and analysis is the thing ad
 * networks, search engines and readers actually value. Originals are ranked
 * above wire items everywhere they appear together, and they open on this
 * site rather than linking away.
 *
 * ── Frontmatter ────────────────────────────────────────────────────────────
 *   ---
 *   title:  Why the Chiba Jets keep winning the fourth quarter
 *   dek:    A short standfirst, one or two sentences.
 *   league: BLeague          # a key from leagues.js, or omit for cross-league
 *   author: Your Name
 *   published: 2026-09-09    # ISO date
 *   tag: Analysis            # Analysis | Feature | Report | Explainer …
 *   image: https://…         # optional hero
 *   imageCredit: Photo by …  # required whenever `image` is set
 *   draft: true              # hidden from the site until removed
 *   ---
 */
import { marked } from 'marked'
import { decorateAffiliateLinks } from './affiliate.js'

marked.setOptions({ gfm: true, breaks: false })

/**
 * Minimal frontmatter parser.
 *
 * Deliberately not a YAML library: the fields above are flat `key: value`
 * pairs, and pulling in a full YAML parser (plus its Buffer polyfill) to read
 * eight keys is not a trade worth making.
 */
function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) return { data: {}, body: raw }

  const data = {}
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z][\w-]*)\s*:\s*(.*)$/)
    if (!m) continue
    let value = m[2].trim().replace(/^["'](.*)["']$/, '$1')
    if (value === 'true') value = true
    else if (value === 'false') value = false
    data[m[1]] = value
  }
  return { data, body: match[2] }
}

/** Rough reading time, at a conventional 220 words per minute. */
function readingTime(body) {
  const words = body.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 220))
}

function slugFromPath(path) {
  return path.split('/').pop().replace(/\.md$/, '')
}

// Eager glob: articles are part of the bundle, so there is nothing to fetch
// at runtime and no loading state to design around.
const files = import.meta.glob('/content/articles/*.md', { query: '?raw', import: 'default', eager: true })

const all = Object.entries(files)
  .map(([path, raw]) => {
    const { data, body } = parseFrontmatter(raw)
    const slug = data.slug || slugFromPath(path)
    return {
      id: `original-${slug}`,
      slug,
      original: true,
      league: data.league || null,
      title: data.title || slug,
      description: data.dek || '',
      byline: data.author || null,
      published: data.published || null,
      tag: data.tag || 'Analysis',
      image: data.image || null,
      imageCredit: data.imageCredit || null,
      imageCaption: data.imageCredit || null,
      draft: data.draft === true,
      readingTime: readingTime(body),
      body,
      /** Internal route — originals never link off-site. */
      href: `/story/${slug}`,
      url: null,
    }
  })
  .filter((a) => !a.draft)
  .sort((a, b) => new Date(b.published || 0) - new Date(a.published || 0))

export function getOriginals(leagueKey = null, limit = Infinity) {
  const list = leagueKey ? all.filter((a) => a.league === leagueKey) : all
  return list.slice(0, limit)
}

export function getOriginal(slug) {
  return all.find((a) => a.slug === slug) || null
}

/**
 * Rendered HTML for an article body. Safe: the source is our own repo.
 *
 * Affiliate links are rewritten here rather than in the page, so `rel` and
 * tracking parameters are correct on first paint. The returned partner list
 * drives the disclosure notice.
 */
export function renderBody(body) {
  const raw = marked.parse(body || '')
  return decorateAffiliateLinks(raw)
}

/** Other pieces worth reading after this one. */
export function relatedOriginals(article, limit = 3) {
  if (!article) return []
  return all
    .filter((a) => a.slug !== article.slug)
    .sort((a, b) => {
      const score = (x) => (x.league === article.league ? 2 : 0) + (x.tag === article.tag ? 1 : 0)
      return score(b) - score(a) || new Date(b.published || 0) - new Date(a.published || 0)
    })
    .slice(0, limit)
}

export const originalCount = all.length

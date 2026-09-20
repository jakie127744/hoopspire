/**
 * The writing that is actually yours — across two desks.
 *
 * ── The Margin ─────────────────────────────────────────────────────────────
 * Named for both senses: the margin of victory, and the notes written in the
 * margin. Stats-first analysis built on the box scores, standings and season
 * averages the rest of the site already collects. Files live in
 * /content/articles/*.md.
 *
 * ── Free Minutes ────────────────────────────────────────────
 * The NBA fantasy desk. Also named twice over: minutes are the currency of
 * fantasy value, and free minutes are the ones a trade or a departure has
 * just put back on the table. Projections, category math and roster
 * construction. Files live in /content/fantasy/*.md, and the desk publishes
 * daily.
 *
 * Both desks share this module because they share everything that matters:
 * the same frontmatter, the same renderer, the same /story/:slug route, the
 * same card. Only the `desk` field differs, and it is what the section pages
 * filter on. Keeping them in one pipeline means a fantasy piece can never
 * quietly diverge into a second, subtly different article format.
 *
 * Posts are bundled at build time by Vite, so there is no CMS, no database
 * and no backend to run. Add a file, and it appears on the site.
 *
 * ── Frontmatter ────────────────────────────────────────────────────────────
 *   ---
 *   title:  Why the Chiba Jets keep winning the fourth quarter
 *   dek:    A short standfirst, one or two sentences.
 *   league: BLeague          # a key from leagues.js, or omit for cross-league
 *   author: Your Name
 *   published: 2026-09-09    # ISO date
 *   tag: Analysis            # Analysis | Data | Trends | Explainer | Feature
 *   image: https://…         # optional hero
 *   imageCredit: Photo by …  # required whenever `image` is set
 *   draft: true              # hidden from the site until removed
 *   ---
 *
 * `desk` is not a frontmatter field on purpose — it comes from the directory
 * the file sits in, so a piece cannot end up on the wrong desk because of a
 * typo, and moving one between desks is a `git mv` rather than an edit.
 */
import { marked } from 'marked'
import { decorateAffiliateLinks } from './affiliate.js'

marked.setOptions({ gfm: true, breaks: false })

/** The two desks, and how each presents itself. */
export const DESKS = {
  margin: {
    key: 'margin',
    name: 'The Margin',
    path: '/margin',
    /** Tailwind colour for the badge and rules. */
    accent: 'gold',
  },
  fantasy: {
    key: 'fantasy',
    name: 'Free Minutes',
    path: '/free-minutes',
    accent: 'crimson',
  },
  news: {
    key: 'news',
    name: 'Full Court Press',
    path: '/press',
    accent: 'ink',
  },
}

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

// Eager globs: articles are part of the bundle, so there is nothing to fetch
// at runtime and no loading state to design around. Vite requires the glob
// pattern to be a literal, so the two desks are listed rather than looped.
const files = {
  margin: import.meta.glob('/content/articles/*.md', { query: '?raw', import: 'default', eager: true }),
  fantasy: import.meta.glob('/content/fantasy/*.md', { query: '?raw', import: 'default', eager: true }),
  news: import.meta.glob('/content/news/*.md', { query: '?raw', import: 'default', eager: true }),
}

function build(path, raw, desk) {
  const { data, body } = parseFrontmatter(raw)
  const slug = data.slug || slugFromPath(path)
  return {
    id: `original-${slug}`,
    slug,
    original: true,
    desk,
    deskName: DESKS[desk].name,
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
    /** Internal route — our own pieces never link off-site. */
    href: `/story/${slug}`,
    url: null,
  }
}

const all = Object.entries(files)
  .flatMap(([desk, group]) => Object.entries(group).map(([path, raw]) => build(path, raw, desk)))
  .filter((a) => !a.draft)
  .sort((a, b) => new Date(b.published || 0) - new Date(a.published || 0))

/**
 * Everything we wrote, from every desk.
 *
 * The front page and the league pages use this: a reader looking for NBA
 * coverage wants the fantasy draft guide alongside the projection piece, and
 * has no reason to care which desk filed it.
 */
export function getOriginals(leagueKey = null, limit = Infinity) {
  const list = leagueKey ? all.filter((a) => a.league === leagueKey) : all
  return list.slice(0, limit)
}

/** One desk's output, for its own section page. */
export function getDesk(desk, leagueKey = null, limit = Infinity) {
  return all
    .filter((a) => a.desk === desk && (!leagueKey || a.league === leagueKey))
    .slice(0, limit)
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

/**
 * Other pieces worth reading after this one.
 *
 * Same desk counts for more than same league: someone who just read a
 * nine-cat punt guide is better served by another fantasy piece about a
 * different team than by a game report about the same one.
 */
export function relatedOriginals(article, limit = 3) {
  if (!article) return []
  return all
    .filter((a) => a.slug !== article.slug)
    .sort((a, b) => {
      const score = (x) =>
        (x.desk === article.desk ? 4 : 0) +
        (x.league === article.league ? 2 : 0) +
        (x.tag === article.tag ? 1 : 0)
      return score(b) - score(a) || new Date(b.published || 0) - new Date(a.published || 0)
    })
    .slice(0, limit)
}

export const originalCount = all.length

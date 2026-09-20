/**
 * Scaffold a new article on either desk, and lint the ones already written.
 *
 *   node scripts/new-article.mjs "Why the Jets keep winning the fourth"
 *   node scripts/new-article.mjs "…" --league BLeague --tag Data
 *   node scripts/new-article.mjs "…" --desk fantasy --tag Draft
 *   node scripts/new-article.mjs --lint          # check every existing article
 *
 * `--desk fantasy` files into /content/fantasy instead of /content/articles,
 * which is what puts the piece on Free Minutes rather than The Margin — the
 * desk comes from the directory, never from a frontmatter field, so it cannot
 * be set wrong by a typo.
 *
 * Why the lint mode exists: `src/lib/articles.js` parses frontmatter with a
 * deliberately minimal reader, and it never throws. A malformed field does not
 * break the build — it degrades silently:
 *
 *   league: FIBA, WNBA   ->  matches no league page, so the piece appears on none
 *   Author: Jane         ->  the parser keeps `Author`, the site reads `author`,
 *                            and the byline quietly disappears
 *   tag: a, b, c, d      ->  the whole string is rendered as one tag chip
 *
 * Each of those ships a live page that looks fine in CI and wrong to readers,
 * which is the expensive kind of mistake. So the check has to be explicit.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONTENT = path.join(__dirname, '..', 'content')

/** Where each desk's files live, matched to the globs in src/lib/articles.js. */
const DESKS = {
  margin: { dir: path.join(CONTENT, 'articles'), rel: 'content/articles', author: 'Hoopspire Staff' },
  fantasy: { dir: path.join(CONTENT, 'fantasy'), rel: 'content/fantasy', author: 'Franco Medina' },
}

const LEAGUES = [
  'FIBA', 'NBA', 'WNBA', 'GLeague', 'NCAAM', 'NBB',
  'EuroLeague', 'PBA', 'KBL', 'BLeague', 'CBA', 'TPBL', 'NBL',
]
/**
 * Tags, per desk.
 *
 * Free Minutes needs its own vocabulary: `Analysis` tells a fantasy manager
 * nothing, while `Draft` and `Waivers` tell them whether the piece is worth
 * reading in October or in February. The Margin's set stays untouched.
 */
const TAGS_BY_DESK = {
  margin: ['Analysis', 'Data', 'Trends', 'Explainer', 'Feature'],
  fantasy: ['Draft', 'Projections', 'Categories', 'Waivers', 'Trades', 'Injuries'],
}
const TAGS = TAGS_BY_DESK.margin
const REQUIRED = ['title', 'dek', 'author', 'published', 'tag']

/** Same reader as src/lib/articles.js, so the lint sees what the site sees. */
function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) return null

  const data = {}
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z][\w-]*)\s*:\s*(.*)$/)
    if (!m) continue
    let value = m[2].trim().replace(/^["'](.*)["']$/, '$1')
    if (value === 'true') value = true
    else if (value === 'false') value = false
    data[m[1]] = value
  }
  return data
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/** Returns a list of human-readable problems; empty means the file is clean. */
export function lintArticle(filename, raw, desk = 'margin') {
  const tags = TAGS_BY_DESK[desk]
  const problems = []
  const data = parseFrontmatter(raw)

  if (!data) return ['no frontmatter block']

  // The site's regex tolerates a closing fence of `-----------` because its
  // trailing newline matcher is optional — so the leftover dashes fall into
  // the body and render as a stray horizontal rule above the first paragraph.
  // It parses, it ships, and it looks like a mistake. Check the fences exactly.
  const fences = raw.match(/^---\r?\n([\s\S]*?)\r?\n(-{3,})/)
  if (fences && fences[2] !== '---') {
    problems.push(`closing fence is \`${fences[2]}\` — it must be exactly \`---\``)
  }

  for (const field of REQUIRED) {
    if (!data[field]) problems.push(`missing required field \`${field}\``)
  }

  // Capitalised keys are the trap: the parser keeps them, the site never reads
  // them, and the field silently vanishes from the page.
  for (const key of Object.keys(data)) {
    const canonical = [...REQUIRED, 'league', 'image', 'imageCredit', 'draft', 'slug']
      .find((f) => f.toLowerCase() === key.toLowerCase())
    if (canonical && canonical !== key) {
      problems.push(`\`${key}\` should be \`${canonical}\` — the site reads the lowercase form`)
    }
  }

  if (data.league && !LEAGUES.includes(data.league)) {
    problems.push(
      data.league.includes(',')
        ? `league \`${data.league}\` is a list — it must be a single key, or omitted for a cross-league story`
        : `league \`${data.league}\` is not a key in src/lib/leagues.js`,
    )
  }

  if (data.tag && !tags.includes(data.tag)) {
    problems.push(`tag \`${data.tag}\` is not one of ${tags.join(', ')}`)
  }

  if (data.published && !/^\d{4}-\d{2}-\d{2}$/.test(data.published)) {
    problems.push(`published \`${data.published}\` must be an ISO date, YYYY-MM-DD`)
  }

  if (data.image && !data.imageCredit) {
    problems.push('image is set without imageCredit')
  }

  const slug = filename.replace(/\.md$/, '')
  if (slug !== slug.toLowerCase()) {
    problems.push(`filename \`${filename}\` should be lowercase — it becomes the URL`)
  }

  return problems
}

async function lint() {
  let failed = 0
  let total = 0

  for (const [desk, { dir, rel }] of Object.entries(DESKS)) {
    // A desk with no directory yet is not an error — it just has nothing filed.
    let files = []
    try {
      files = (await fs.readdir(dir)).filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    } catch {
      continue
    }
    total += files.length

    for (const file of files) {
      const raw = await fs.readFile(path.join(dir, file), 'utf8')
      const problems = lintArticle(file, raw, desk)
      if (problems.length) {
        failed++
        console.error(`
  ${rel}/${file}`)
        for (const p of problems) console.error(`    - ${p}`)
      }
    }
  }

  if (failed) {
    console.error(`
${failed} of ${total} articles have problems.
`)
    process.exit(1)
  }
  console.log(`${total} articles across ${Object.keys(DESKS).length} desks, all clean.`)
}

async function create(title, opts) {
  const desk = DESKS[opts.desk || 'margin']
  if (!desk) {
    console.error(`--desk must be one of: ${Object.keys(DESKS).join(', ')}`)
    process.exit(1)
  }
  const tags = TAGS_BY_DESK[opts.desk || 'margin']

  const slug = slugify(title)
  await fs.mkdir(desk.dir, { recursive: true })
  const target = path.join(desk.dir, `${slug}.md`)

  try {
    await fs.access(target)
    console.error(`${slug}.md already exists — pick a different title or edit that file.`)
    process.exit(1)
  } catch {
    // Does not exist, which is what we want.
  }

  if (opts.league && !LEAGUES.includes(opts.league)) {
    console.error(`--league must be one of: ${LEAGUES.join(', ')}`)
    process.exit(1)
  }
  if (opts.tag && !tags.includes(opts.tag)) {
    console.error(`--tag must be one of: ${tags.join(', ')}`)
    process.exit(1)
  }

  const today = new Date().toISOString().slice(0, 10)
  const frontmatter = [
    '---',
    `title: ${title}`,
    'dek: One or two sentences of standfirst. This shows on cards and in search results, so make it say something.',
    ...(opts.league ? [`league: ${opts.league}`] : []),
    `author: ${opts.author || desk.author}`,
    `published: ${today}`,
    `tag: ${opts.tag || tags[0]}`,
    'draft: true',
    '---',
    '',
    'Lead with a number that surprises, then explain it. Say the sample size.',
    '',
    'Delete `draft: true` when it is ready to go live.',
    '',
  ].join('\n')

  await fs.writeFile(target, frontmatter, 'utf8')
  console.log(`Created ${desk.rel}/${slug}.md`)
  console.log(`It will publish at /story/${slug} once you remove \`draft: true\`.`)
}

const argv = process.argv.slice(2)

if (argv.includes('--lint')) {
  await lint()
} else {
  const title = argv.find((a) => !a.startsWith('--'))
  if (!title) {
    console.error('Usage: node scripts/new-article.mjs "Your headline"  [--desk margin|fantasy] [--league KEY] [--tag Analysis]')
    console.error('       node scripts/new-article.mjs --lint')
    process.exit(1)
  }
  const flag = (name) => {
    const i = argv.indexOf(`--${name}`)
    return i === -1 ? null : argv[i + 1]
  }
  await create(title, {
    desk: flag('desk'),
    league: flag('league'),
    tag: flag('tag'),
    author: flag('author'),
  })
}

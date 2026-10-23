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

import { getStaff, beatWriters, filesFor } from '../src/lib/staff.js'
import { CONNECTIONS, FIBA_STATUS } from '../src/lib/scouting.js'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONTENT = path.join(__dirname, '..', 'content')

/** Where each desk's files live, matched to the globs in src/lib/articles.js. */
const DESKS = {
  margin: { dir: path.join(CONTENT, 'articles'), rel: 'content/articles', author: 'Hoopspire Staff' },
  fantasy: { dir: path.join(CONTENT, 'fantasy'), rel: 'content/fantasy', author: 'Franco Medina' },
  news: { dir: path.join(CONTENT, 'news'), rel: 'content/news', author: 'Hoopspire Staff' },
  opinion: { dir: path.join(CONTENT, 'opinion'), rel: 'content/opinion', author: 'Victor Ashby' },
  scouting: { dir: path.join(CONTENT, 'scouting'), rel: 'content/scouting', author: 'Victor Ashby' },
}

const LEAGUES = [
  'FIBA', 'NBA', 'WNBA', 'GLeague', 'NCAAM', 'NBB', 'LNBP',
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
  // Full Court Press reports events, so its tags say what KIND of event —
  // which is what a reader scanning a news index is actually sorting by.
  news: ['Report', 'Signing', 'Trade', 'Injury', 'Result', 'Preview', 'Feature'],
  // Opinion: the tag is the column. Second Look is Victor Ashby's, Hot Hand
  // is Noor Haddad's, Jump Ball is the two of them on opposite sides.
  opinion: ['Second Look', 'Hot Hand', 'Jump Ball'],
  // Heritage Line (owner, 2026-10-18): the weekly scouting pieces are columns,
  // Second Look by Victor Ashby and Hot Hand by Noor Haddad. Eligibility is
  // news, filed by Amara Diallo only when there is a ruling to report.
  scouting: ['Second Look', 'Hot Hand', 'Eligibility'],
}

/** Other Hoopspire articles a Heritage Line piece must link to. */
const SCOUTING_MIN_LINKS = 2

/** Which home desk a Heritage Line tag belongs to. */
const SCOUTING_KIND = {
  Eligibility: 'news',
  'Second Look': 'opinion',
  'Hot Hand': 'opinion',
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

/** The Markdown after the frontmatter. */
function bodyOf(raw) {
  const match = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/)
  return match ? match[1] : raw
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
/**
 * `published` maps the slug of every article on every desk to whether it is
 * live (not a draft). lint() fills it before checking any file, so a link is
 * checked against the whole site rather than one desk.
 */
export function lintArticle(filename, raw, desk = 'margin', { published = new Map() } = {}) {
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
    const canonical = [...REQUIRED, 'league', 'league2', 'image', 'imageCredit', 'draft', 'slug', 'game', 'nation', 'connection', 'status', 'player']
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
  // league2: the second club's home league, for a cross-league club game
  // (East Asia Super League). Needs a primary league, a valid key, and a
  // different one.
  if (data.league2) {
    if (!data.league) problems.push('`league2` is set without `league`')
    else if (!LEAGUES.includes(data.league2)) problems.push(`league2 \`${data.league2}\` is not a key in src/lib/leagues.js`)
    else if (data.league2 === data.league) problems.push('`league2` repeats `league`')
  }

  // Bylines must exist on the masthead, sit on this desk, and on the news
  // desk cover the league. Older pieces were re-bylined to their beat on 2026-10-08.
  if (data.author) {
    const writer = getStaff(data.author)
    if (!writer) {
      problems.push(`author \`${data.author}\` is not on the masthead in src/lib/staff.js`)
    } else if (!filesFor(writer, desk) && !(desk === 'news' && data.author === 'Hoopspire Staff')) {
      problems.push(`author \`${data.author}\` writes for the ${writer.desk} desk, not ${desk}`)
    } else if (desk === 'scouting' && SCOUTING_KIND[data.tag] && writer.desk !== SCOUTING_KIND[data.tag]) {
      problems.push(`${data.tag} is ${SCOUTING_KIND[data.tag]} on Heritage Line; ${data.author} files ${writer.desk}`)
    } else if (
      desk === 'news' && writer.leagues && data.league &&
      !writer.leagues.includes(data.league) &&
      !(data.league2 && writer.leagues.includes(data.league2))
    ) {
      problems.push(`author \`${data.author}\` does not cover ${data.league}; use ${beatWriters(data.league).map((s) => s.byline).join(' or ') || 'Hoopspire Staff'}`)
    }
  }

  // A column belongs to its columnist.
  const COLUMN_OWNER = { 'Second Look': 'Victor Ashby', 'Hot Hand': 'Noor Haddad' }
  // And a columnist writes about his or her own region. Jump Ball pieces are
  // exempt: both sides of one question, possibly anywhere.
  if (desk === 'opinion' && data.tag !== 'Jump Ball' && data.league && data.author) {
    const w = getStaff(data.author)
    if (w && w.leagues && !w.leagues.includes(data.league)) {
      problems.push(`${data.author} covers ${w.leagues.join(', ')}, not ${data.league}`)
    }
  }
  if ((desk === 'opinion' || desk === 'scouting') && COLUMN_OWNER[data.tag] && data.author !== COLUMN_OWNER[data.tag]) {
    problems.push(`${data.tag} is ${COLUMN_OWNER[data.tag]}'s column, not ${data.author}'s`)
  }

  // Heritage Line: every piece is about a national team, so it is filed under
  // FIBA (league2 may add the league the player plays in), and carries the
  // eligibility file the Story page prints under the dek.
  if (desk === 'scouting') {
    if (data.league !== 'FIBA') problems.push("Heritage Line pieces are `league: FIBA`; the player's club league goes in `league2`")
    if (!data.nation) problems.push('missing `nation`: the national team the player could represent')
    if (!CONNECTIONS[data.connection]) problems.push(`\`connection\` must be one of ${Object.keys(CONNECTIONS).join(', ')}`)
    if (!FIBA_STATUS[data.status]) problems.push(`\`status\` must be one of ${Object.keys(FIBA_STATUS).join(', ')}`)

    // Ready to publish (owner, 2026-10-18): one player per piece, named in
    // the headline, and linked into the rest of the site. Drafts are exempt,
    // so a fresh scaffold does not fail the lint before anyone has written it.
    if (data.draft !== true) {
      const player = String(data.player || '').trim()
      if (!player) {
        problems.push('missing `player`: the one player this piece is about')
      } else if (/[,;&/]|\band\b/i.test(player)) {
        problems.push(`\`player\` is \`${player}\`: one player per piece; others can be mentioned in the body`)
      } else {
        const surname = player.split(/\s+/).pop().toLowerCase()
        if (!String(data.title || '').toLowerCase().includes(surname)) {
          problems.push(`the headline does not name ${player}`)
        }
      }

      const self = data.slug || filename.replace(/\.md$/, '')
      const links = [...bodyOf(raw).matchAll(/\]\(\/story\/([^)#?\s]+)/g)].map((m) => m[1])
      const others = [...new Set(links.filter((s) => s !== self))]
      for (const s of others) {
        if (!published.has(s)) problems.push(`links to /story/${s}, which does not exist`)
        else if (!published.get(s)) problems.push(`links to /story/${s}, which is still a draft`)
      }
      if (others.length < SCOUTING_MIN_LINKS) {
        problems.push(`links to ${others.length} other article(s); Heritage Line pieces link to at least ${SCOUTING_MIN_LINKS}`)
      }
    }
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

  // `game` links this piece to a specific ESPN event so the Game page can
  // show it instead of the wire's recap — see getGameRecap in articles.js.
  // The match is scoped to `league`, so `game` without it can never resolve
  // and the piece silently never appears on its own game page.
  if (data.game) {
    if (!data.league) {
      problems.push('`game` is set without `league` — the recap can never match a game page without it')
    }
    if (!/^\d+$/.test(String(data.game))) {
      problems.push(`game \`${data.game}\` should be the bare ESPN event id (digits only)`)
    }
  }

  const slug = filename.replace(/\.md$/, '')
  if (slug !== slug.toLowerCase()) {
    problems.push(`filename \`${filename}\` should be lowercase — it becomes the URL`)
  }

  return problems
}

/** ISO week of a YYYY-MM-DD date, as "2026-W42". */
function isoWeek(date) {
  const d = new Date(`${date}T00:00:00Z`)
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day) // the Thursday decides the week
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d - yearStart) / 86_400_000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/**
 * Heritage Line publishes two columns a week, one from each columnist (owner,
 * 2026-10-18). The lint can't make a writer file; it can stop one columnist
 * filing twice in a week, which is how a two-writer desk turns into one.
 * Eligibility rulings are news and run when they happen, so they are not
 * counted.
 */
/**
 * Extra columns the owner approved outside the weekly two. One file per entry,
 * with the date and reason, so an exception never becomes the habit.
 */
const OWNER_EXTRA_COLUMNS = {
  // Owner, 2026-10-23: a third Heritage Line column in 2026-W43 (non-Philippines tie).
  'gabriela-jaquez-missed-mexicos-summer-save-the-big-ask-for-2028.md': '2026-10-23',
}

function scoutingCadence(files) {
  const seen = new Map()
  const problems = []
  // Oldest first, so the piece flagged is the second one filed that week.
  const byDate = [...files].sort((a, b) => String(a.data?.published).localeCompare(String(b.data?.published)))
  for (const { desk, rel, file, data } of byDate) {
    if (desk !== 'scouting' || !data || data.draft === true || !data.author || !data.published) continue
    if (SCOUTING_KIND[data.tag] !== 'opinion') continue
    if (OWNER_EXTRA_COLUMNS[file]) continue
    const key = `${data.author} ${isoWeek(data.published)}`
    if (seen.has(key)) {
      problems.push([`${rel}/${file}`, `${data.author} already filed ${seen.get(key)} in ${isoWeek(data.published)}; Heritage Line runs one column per columnist per week`])
    } else {
      seen.set(key, file)
    }
  }
  return problems
}

async function lint() {
  // Read every desk first: a link on one desk can point at another.
  const files = []
  for (const [desk, { dir, rel }] of Object.entries(DESKS)) {
    // A desk with no directory yet is not an error — it just has nothing filed.
    let names = []
    try {
      names = (await fs.readdir(dir)).filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    } catch {
      continue
    }
    for (const file of names) {
      const raw = await fs.readFile(path.join(dir, file), 'utf8')
      files.push({ desk, rel, file, raw, data: parseFrontmatter(raw) })
    }
  }
  const published = new Map(
    files.map(({ file, data }) => [data?.slug || file.replace(/\.md$/, ''), data?.draft !== true])
  )

  const report = new Map()
  for (const { desk, rel, file, raw } of files) {
    const problems = lintArticle(file, raw, desk, { published })
    if (problems.length) report.set(`${rel}/${file}`, problems)
  }
  for (const [where, problem] of scoutingCadence(files)) {
    report.set(where, [...(report.get(where) || []), problem])
  }

  for (const [where, problems] of report) {
    console.error(`
  ${where}`)
    for (const p of problems) console.error(`    - ${p}`)
  }
  if (report.size) {
    console.error(`
${report.size} of ${files.length} articles have problems.
`)
    process.exit(1)
  }
  console.log(`${files.length} articles across ${Object.keys(DESKS).length} desks, all clean.`)
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
    ...(opts.league || opts.desk === 'scouting' ? [`league: ${opts.league || 'FIBA'}`] : []),
    ...(opts.desk === 'scouting'
      ? ['player: Full name of the one player this piece is about', 'nation: Country the player could represent', 'connection: parent', 'status: pending']
      : []),
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
    console.error('Usage: node scripts/new-article.mjs "Your headline"  [--desk margin|fantasy|news|opinion|scouting] [--league KEY] [--tag Analysis]')
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

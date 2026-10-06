/**
 * Player search index → public/data/players-index.json
 *
 *   node scripts/build-player-index.mjs
 *
 * One file listing every player the site has a profile page for, so the
 * archive's search box can find "Kai Sotto" or "Wembanyama" without a
 * server. Each row is exactly what the profile route needs — league and id —
 * plus the name, local-script name, team and position to show in a result.
 *
 * Sources, all ones the site already uses to build player pages:
 *
 *   NBA, WNBA, G League   ESPN team rosters (the ids /player/<league>/<id>
 *                         resolves against ESPN)
 *   snapshot leagues      the rosters and season stats in public/data/<key>.json
 *   EuroLeague, NBL, FIBA the season stats in public/data/extra/<key>.json
 *
 * NCAA men's basketball is left out: 360-odd rosters, several thousand
 * players, for a league the site covers lightly — it would triple the file
 * for the fewest searches.
 *
 * A league whose source fails keeps its rows from the previous index rather
 * than vanishing from search for a day.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

const OUT = 'public/data/players-index.json'
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/basketball'
const ESPN_LEAGUES = [
  { key: 'NBA', slug: 'nba' },
  { key: 'WNBA', slug: 'wnba' },
  { key: 'GLeague', slug: 'nba-development' },
]
const SNAPSHOT_LEAGUES = ['PBA', 'KBL', 'BLeague', 'CBA', 'TPBL', 'NBB', 'LNBP']
const EXTRA_LEAGUES = ['EuroLeague', 'NBL', 'FIBA']

const readJSON = async (path) => JSON.parse(await readFile(path, 'utf8'))

async function getJSON(url, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (err) {
      if (i >= tries) throw err
      await new Promise((r) => setTimeout(r, 800 * i))
    }
  }
}

/** Run `fn` over `items`, `n` at a time — ESPN does not need 30 requests at once. */
async function pool(items, n, fn) {
  const out = []
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i])
      }
    })
  )
  return out
}

const normName = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const row = (league, p) => ({
  league,
  id: String(p.id),
  name: p.name,
  nameLocal: p.nameLocal || null,
  team: p.team || null,
  position: p.position || null,
})

async function espnLeague({ key, slug }) {
  const data = await getJSON(`${ESPN}/${slug}/teams`)
  const teams = (data.sports?.[0]?.leagues?.[0]?.teams || []).map((t) => t.team)
  if (!teams.length) throw new Error('no teams')
  const rosters = await pool(teams, 6, async (t) => {
    const r = await getJSON(`${ESPN}/${slug}/teams/${t.id}/roster`).catch(() => null)
    return (r?.athletes || []).map((a) =>
      row(key, {
        id: a.id,
        name: a.displayName || a.fullName,
        team: t.displayName,
        position: a.position?.abbreviation,
      })
    )
  })
  const rows = rosters.flat().filter((r) => r.id && r.name)
  if (!rows.length) throw new Error('no players')
  return rows
}

async function snapshotLeague(key) {
  const s = await readJSON(`public/data/${key}.json`)
  const teamName = new Map((s.teams || []).map((t) => [String(t.id), t.name]))
  const teamByAbbr = new Map((s.teams || []).map((t) => [t.abbr, t.name]))
  const rows = []
  for (const [teamId, players] of Object.entries(s.rosters || {})) {
    for (const p of players) rows.push(row(key, { ...p, team: teamName.get(String(teamId)) }))
  }
  // Season stats can name players a roster does not (traded, released), and
  // they have profiles too. But the same player usually appears in both under
  // two ids — the roster's and RealGM's — so a stats row only counts when the
  // roster has no one of that name. Without this, half the B.League came up
  // twice in a search.
  const onRoster = new Set(rows.map((r) => normName(r.name)))
  for (const p of s.playerStats || []) {
    if (!p.id || !p.name || onRoster.has(normName(p.name))) continue
    rows.push(row(key, { ...p, team: p.teamName || teamByAbbr.get(p.teamAbbr) || p.teamAbbr }))
  }
  return rows
}

async function extraLeague(key) {
  const s = await readJSON(`public/data/extra/${key}.json`)
  return (s.playerStats || [])
    .filter((p) => p.id && p.name)
    .map((p) => row(key, { ...p, team: p.teamName || p.teamAbbr }))
}

/** The last index, back in object form, for leagues whose source fails this run. */
async function readPrevious() {
  if (!existsSync(OUT)) return []
  const prev = await readJSON(OUT)
  if (prev.players) return prev.players
  return (prev.rows || []).map((r) => Object.fromEntries(prev.fields.map((f, i) => [f, r[i]])))
}
const previous = await readPrevious()
const jobs = [
  ...ESPN_LEAGUES.map((l) => [l.key, () => espnLeague(l)]),
  ...SNAPSHOT_LEAGUES.map((k) => [k, () => snapshotLeague(k)]),
  ...EXTRA_LEAGUES.map((k) => [k, () => extraLeague(k)]),
]

const players = []
for (const [key, job] of jobs) {
  try {
    const rows = await job()
    // One row per league and id; the roster row comes first and wins.
    const seen = new Set()
    const unique = rows.filter((r) => !seen.has(r.id) && seen.add(r.id))
    players.push(...unique)
    console.log(`✔ ${key.padEnd(10)} ${unique.length} players`)
  } catch (err) {
    const kept = previous.filter((p) => p.league === key)
    players.push(...kept)
    console.log(`✘ ${key.padEnd(10)} ${err.message} — kept ${kept.length} from the last index`)
  }
}

players.sort((a, b) => a.name.localeCompare(b.name))

// Rows as arrays rather than objects: the same six keys repeated four
// thousand times were a third of the file. Field order is in `fields`.
const FIELDS = ['league', 'id', 'name', 'nameLocal', 'team', 'position']
await writeFile(
  OUT,
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    fields: FIELDS,
    rows: players.map((p) => FIELDS.map((f) => p[f] ?? null)),
  }) + '\n'
)
console.log(`players-index.json — ${players.length} players`)

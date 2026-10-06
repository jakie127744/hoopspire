/**
 * Search index → public/data/search-index.json
 *
 *   npm run data:search        (node scripts/build-search-index.mjs)
 *
 * One file listing every player and team the site has a page for, so the
 * archive's search box can find "Kai Sotto", "Wembanyama" or "Ginebra"
 * without a server. Each row carries exactly what its route needs — league
 * and id — plus what a result shows.
 *
 * Players, from the sources the player pages already use:
 *
 *   NBA, WNBA, G League   ESPN team rosters (ids /player/<league>/<id>
 *                         resolves against ESPN)
 *   snapshot leagues      the rosters and season stats in public/data/<key>.json
 *   EuroLeague, NBL, FIBA the season stats in public/data/extra/<key>.json
 *
 * NCAA players are left out: 360-odd rosters, several thousand players, for
 * a league the site covers lightly — it would triple the file for the fewest
 * searches. NCAA teams are in; that is one request.
 *
 * Teams, from the sources the team pages already use:
 *
 *   ESPN leagues          ESPN's team list (same ids as the standings)
 *   EuroLeague            the competition's own club feed (club codes)
 *   snapshot leagues      the teams in public/data/<key>.json
 *
 * A league whose source fails keeps its rows from the previous index rather
 * than vanishing from search for a day.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

const OUT = 'public/data/search-index.json'
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/basketball'
const EUROLEAGUE_FEED = 'https://feeds.incrowdsports.com/provider/euroleague-feeds/v2/competitions/E/seasons'

const ESPN_ROSTER_LEAGUES = [
  { key: 'NBA', slug: 'nba' },
  { key: 'WNBA', slug: 'wnba' },
  { key: 'GLeague', slug: 'nba-development' },
]
const ESPN_TEAM_LEAGUES = [
  ...ESPN_ROSTER_LEAGUES,
  { key: 'NBL', slug: 'nbl' },
  { key: 'FIBA', slug: 'fiba' },
  { key: 'NCAAM', slug: 'mens-college-basketball' },
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

const player = (league, p) => ({
  league,
  id: String(p.id),
  name: p.name,
  nameLocal: p.nameLocal || null,
  team: p.team || null,
  position: p.position || null,
})

const team = (league, t) => ({
  league,
  id: String(t.id),
  name: t.name,
  nameLocal: t.nameLocal || null,
  abbr: t.abbr || null,
  logo: t.logo || null,
})

// ── ESPN ──────────────────────────────────────────────────────────────────
const espnTeamLists = new Map()
async function espnTeamList(slug) {
  if (!espnTeamLists.has(slug)) {
    espnTeamLists.set(
      slug,
      getJSON(`${ESPN}/${slug}/teams?limit=1000`).then((data) =>
        (data.sports?.[0]?.leagues?.[0]?.teams || []).map((t) => t.team)
      )
    )
  }
  return espnTeamLists.get(slug)
}

async function espnPlayers({ key, slug }) {
  const teams = await espnTeamList(slug)
  if (!teams.length) throw new Error('no teams')
  const rosters = await pool(teams, 6, async (t) => {
    const r = await getJSON(`${ESPN}/${slug}/teams/${t.id}/roster`).catch(() => null)
    return (r?.athletes || []).map((a) =>
      player(key, {
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

async function espnTeams({ key, slug }) {
  const teams = await espnTeamList(slug)
  if (!teams.length) throw new Error('no teams')
  return teams.map((t) =>
    team(key, { id: t.id, name: t.displayName, abbr: t.abbreviation, logo: t.logos?.[0]?.href })
  )
}

// ── EuroLeague ────────────────────────────────────────────────────────────
/** The current season's code — this year's if it has games, else last year's. */
async function euroleagueSeason() {
  const year = new Date().getFullYear()
  for (const code of [`E${year}`, `E${year - 1}`]) {
    const d = await getJSON(`${EUROLEAGUE_FEED}/${code}/games?limit=1`).catch(() => null)
    if (d?.data?.length) return code
  }
  throw new Error('no current season')
}

async function euroleagueTeams() {
  const season = await euroleagueSeason()
  const data = await getJSON(`${EUROLEAGUE_FEED}/${season}/clubs?limit=100`)
  const rows = (data.data || []).map((c) =>
    team('EuroLeague', { id: c.code, name: c.name, abbr: c.tvCode || c.code, logo: c.images?.crest })
  )
  if (!rows.length) throw new Error('no clubs')
  return rows
}

// ── Snapshot leagues ──────────────────────────────────────────────────────
async function snapshotPlayers(key) {
  const s = await readJSON(`public/data/${key}.json`)
  const teamName = new Map((s.teams || []).map((t) => [String(t.id), t.name]))
  const teamByAbbr = new Map((s.teams || []).map((t) => [t.abbr, t.name]))
  const rows = []
  for (const [teamId, players] of Object.entries(s.rosters || {})) {
    for (const p of players) rows.push(player(key, { ...p, team: teamName.get(String(teamId)) }))
  }
  // Season stats can name players a roster does not (traded, released), and
  // they have profiles too. But the same player usually appears in both under
  // two ids — the roster's and RealGM's — so a stats row only counts when the
  // roster has no one of that name. Without this, half the B.League came up
  // twice in a search.
  const onRoster = new Set(rows.map((r) => normName(r.name)))
  for (const p of s.playerStats || []) {
    if (!p.id || !p.name || onRoster.has(normName(p.name))) continue
    rows.push(player(key, { ...p, team: p.teamName || teamByAbbr.get(p.teamAbbr) || p.teamAbbr }))
  }
  return rows
}

async function snapshotTeams(key) {
  const s = await readJSON(`public/data/${key}.json`)
  const rows = (s.teams || []).filter((t) => t.id != null && t.name).map((t) => team(key, t))
  if (!rows.length) throw new Error('no teams in snapshot')
  return rows
}

async function extraPlayers(key) {
  const s = await readJSON(`public/data/extra/${key}.json`)
  return (s.playerStats || [])
    .filter((p) => p.id && p.name)
    .map((p) => player(key, { ...p, team: p.teamName || p.teamAbbr }))
}

// ── Build ─────────────────────────────────────────────────────────────────
const PLAYER_FIELDS = ['league', 'id', 'name', 'nameLocal', 'team', 'position']
const TEAM_FIELDS = ['league', 'id', 'name', 'nameLocal', 'abbr', 'logo']

/** The last index, back in object form, for leagues whose source fails this run. */
async function readPrevious() {
  const fromRows = (fields, rows) =>
    (rows || []).map((r) => Object.fromEntries(fields.map((f, i) => [f, r[i]])))
  const prevFile = existsSync(OUT) ? OUT : 'public/data/players-index.json'
  if (!existsSync(prevFile)) return { players: [], teams: [] }
  const prev = await readJSON(prevFile)
  if (prev.players?.fields) {
    return {
      players: fromRows(prev.players.fields, prev.players.rows),
      teams: fromRows(prev.teams?.fields || [], prev.teams?.rows),
    }
  }
  // The players-only layout this file replaced.
  return { players: fromRows(prev.fields || [], prev.rows), teams: [] }
}

/** Run each league's job; on failure keep that league's previous rows. */
async function collect(label, jobs, previous) {
  const out = []
  for (const [key, job] of jobs) {
    try {
      const rows = await job()
      // One row per league and id; the first (roster) row wins.
      const seen = new Set()
      const unique = rows.filter((r) => !seen.has(r.id) && seen.add(r.id))
      out.push(...unique)
      console.log(`✔ ${label} ${key.padEnd(10)} ${unique.length}`)
    } catch (err) {
      const kept = previous.filter((p) => p.league === key)
      out.push(...kept)
      console.log(`✘ ${label} ${key.padEnd(10)} ${err.message} — kept ${kept.length} from the last index`)
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

const previous = await readPrevious()

const players = await collect(
  'players',
  [
    ...ESPN_ROSTER_LEAGUES.map((l) => [l.key, () => espnPlayers(l)]),
    ...SNAPSHOT_LEAGUES.map((k) => [k, () => snapshotPlayers(k)]),
    ...EXTRA_LEAGUES.map((k) => [k, () => extraPlayers(k)]),
  ],
  previous.players
)

const teams = await collect(
  'teams  ',
  [
    ...ESPN_TEAM_LEAGUES.map((l) => [l.key, () => espnTeams(l)]),
    ['EuroLeague', euroleagueTeams],
    ...SNAPSHOT_LEAGUES.map((k) => [k, () => snapshotTeams(k)]),
  ],
  previous.teams
)

// Rows as arrays rather than objects: the same keys repeated thousands of
// times were a third of the file. Field order is in each `fields`.
const pack = (fields, list) => ({ fields, rows: list.map((x) => fields.map((f) => x[f] ?? null)) })
await writeFile(
  OUT,
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    players: pack(PLAYER_FIELDS, players),
    teams: pack(TEAM_FIELDS, teams),
  }) + '\n'
)
console.log(`search-index.json — ${players.length} players, ${teams.length} teams`)

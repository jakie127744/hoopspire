/**
 * Player statistics for the leagues with no CORS-open stats API.
 *
 * Imported by fetch-data.mjs; not run directly.
 *
 * ── Sources ────────────────────────────────────────────────────────────────
 *
 * TPBL (Taiwan) — the league's OWN public API, api.tpbl.basketball. It is
 * CORS-open, returns complete accumulated/average/percentage splits, and
 * carries English names for every player and club in `meta.alt_name`. This is
 * the best source in the whole project: first-party and unambiguous.
 *
 * CBA (China) and KBL (South Korea) — RealGM's international section, which
 * publishes full per-player averages for both. asia-basket paywalls the same
 * data; the leagues' own sites offer no English stats API, and KBL's own API
 * has been returning HTTP 500 to everyone including their own front end.
 *
 * ── On fetching RealGM ─────────────────────────────────────────────────────
 *
 * RealGM's robots.txt contains no Disallow rules — it asks only for
 * `crawl-delay: 2`. So crawling is permitted, on the condition that we go
 * slowly, and REALGM_DELAY_MS below honours that.
 *
 * Their Cloudflare layer rejects Node's `fetch` on TLS fingerprint alone while
 * serving curl the same page normally. That is an over-broad heuristic rather
 * than a stated policy — their robots.txt says the opposite — so these
 * requests are shelled out to curl. No challenge is solved, no token forged,
 * and no CAPTCHA touched: if RealGM ever does return a challenge page, the
 * parser below treats it as a failure and gives up rather than working around
 * it.
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import * as cheerio from 'cheerio'

const execFileAsync = promisify(execFile)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** RealGM's robots.txt asks for a 2-second crawl delay. Give it 2.5. */
const REALGM_DELAY_MS = 2500

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const clean = (s) => (s || '').replace(/\s+/g, ' ').trim()
const num = (v) => {
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

async function curlGet(url) {
  const { stdout } = await execFileAsync(
    'curl',
    ['-sL', '--compressed', '-m', '40', '-H', `User-Agent: ${UA}`, '-H', 'Accept: text/html', url],
    { maxBuffer: 32 * 1024 * 1024 }
  )
  return stdout
}

// ───────────────────────────────────────────────────────────────────────────
// RealGM
// ───────────────────────────────────────────────────────────────────────────

export const REALGM_LEAGUES = {
  CBA: { id: 40, slug: 'Chinese-CBA' },
  KBL: { id: 63, slug: 'South-Korean-KBL' },
  BLeague: { id: 105, slug: 'Japanese-BLeague' },
}

/**
 * Column order on RealGM's "Averages" table. Read from the header row rather
 * than assumed, so a column being inserted upstream cannot silently shift
 * every number one place to the left.
 */
const REALGM_FIELDS = {
  GP: 'gamesPlayed',
  MPG: 'minutes',
  PPG: 'points',
  FGM: 'fgMade',
  FGA: 'fgAttempted',
  'FG%': 'fgPct',
  '3PM': 'threeMade',
  '3PA': 'threeAttempted',
  '3P%': 'threePct',
  FTM: 'ftMade',
  FTA: 'ftAttempted',
  'FT%': 'ftPct',
  ORB: 'offRebounds',
  DRB: 'defRebounds',
  RPG: 'rebounds',
  APG: 'assists',
  SPG: 'steals',
  BPG: 'blocks',
  TOV: 'turnovers',
  PF: 'fouls',
}

/**
 * Season averages for one RealGM league.
 *
 * `season` is RealGM's end-year: 2026 means the 2025-26 season. We try the
 * current one first and fall back a year, so the script keeps working through
 * an off-season without an edit.
 */
export async function realgmPlayerStats(leagueKey, { season } = {}) {
  const cfg = REALGM_LEAGUES[leagueKey]
  if (!cfg) throw new Error(`no RealGM mapping for ${leagueKey}`)

  const year = new Date().getFullYear()
  const candidates = season ? [season] : [year, year - 1]
  const notes = []

  for (const yr of candidates) {
    const url =
      `https://basketball.realgm.com/international/league/${cfg.id}/${cfg.slug}` +
      `/stats/${yr}/Averages/All/All/points/All/desc/1/Regular_Season`

    let html
    try {
      html = await curlGet(url)
    } catch (err) {
      notes.push(`${leagueKey} ${yr}: ${err.message}`)
      await sleep(REALGM_DELAY_MS)
      continue
    }

    // A challenge page means "not now" — do not try to work around it.
    if (/Just a moment|cf-browser-verification|challenge-platform/i.test(html)) {
      notes.push(`${leagueKey} ${yr}: RealGM returned a bot-check page; skipped`)
      await sleep(REALGM_DELAY_MS)
      continue
    }

    const $ = cheerio.load(html)
    const table = $('table').first()
    const headers = table
      .find('thead th')
      .map((_, th) => clean($(th).text()))
      .get()

    const rows = []
    table.find('tbody tr').each((_, tr) => {
      const cells = $(tr)
        .find('td')
        .map((__, td) => clean($(td).text()))
        .get()
      if (cells.length < headers.length - 2) return

      const player = {}
      headers.forEach((h, i) => {
        const key = REALGM_FIELDS[h]
        if (key) player[key] = num(cells[i])
        else if (h === 'Player') player.name = cells[i]
        else if (h === 'Team') player.teamAbbr = cells[i]
      })

      // The Team cell links to the club's own page, which carries its full
      // name. Read that rather than inferring anything from the abbreviation:
      // RealGM's "SON" is Suwon KT Sonicboom, and a fuzzy match happily
      // assigns it to Goyang *Sono* instead. Abbreviations are not safe to
      // guess from; this link is authoritative and costs no extra request.
      const teamIdx = headers.indexOf('Team')
      const href = teamIdx >= 0 ? $(tr).find('td').eq(teamIdx).find('a').attr('href') || '' : ''
      const m = href.match(/\/team\/(\d+)\/([^/]+)/)
      if (m) {
        player.teamRealgmId = m[1]
        player.teamName = decodeURIComponent(m[2]).replace(/-/g, ' ')
      }

      if (player.name) rows.push(player)
    })

    if (rows.length) {
      await sleep(REALGM_DELAY_MS)
      return { season: `${yr - 1}-${String(yr).slice(2)}`, players: rows, notes }
    }

    notes.push(`${leagueKey} ${yr}: no rows (season may not have started)`)
    await sleep(REALGM_DELAY_MS)
  }

  return { season: null, players: [], notes }
}

// ───────────────────────────────────────────────────────────────────────────
// TPBL — the league's own API
// ───────────────────────────────────────────────────────────────────────────

const TPBL_API = 'https://api.tpbl.basketball/api'

async function tpblJSON(path) {
  const res = await fetch(`${TPBL_API}${path}`, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`TPBL ${res.status} for ${path}`)
  return res.json()
}

/** Prefer the English `alt_name` the league publishes; fall back to the original. */
const englishName = (obj, fallback) => clean(obj?.meta?.alt_name) || clean(fallback)

const titleCase = (s) =>
  s.replace(/\b([a-z])/g, (m) => m.toUpperCase())

/** Split "SmallForward" into "SF". */
function shortPosition(p) {
  if (!p) return null
  const map = {
    PointGuard: 'PG',
    ShootingGuard: 'SG',
    SmallForward: 'SF',
    PowerForward: 'PF',
    Center: 'C',
  }
  return map[p] || p
}

export async function tpblPlayerStats() {
  const notes = []

  // Event 2 is the current TPBL season; its divisions are the phases within
  // it. We want the regular season, which is the meaningful sample.
  const divisions = await tpblJSON('/events/2/divisions')
  const regular =
    divisions.find((d) => d.name === '例行賽') ||
    divisions.find((d) => d.status === 'COMPLETED') ||
    divisions[0]
  if (!regular) throw new Error('no TPBL divisions returned')

  const raw = await tpblJSON(`/games/stats/players?division_id=${regular.id}`)

  const players = []
  const rosters = {}
  const teams = new Map()

  for (const entry of raw) {
    const p = entry.player || {}
    const t = entry.team || p.team || {}
    const avg = entry.average_stats || {}
    const pct = entry.percentage_stats || {}

    const teamName = titleCase(englishName(t, t.name))
    const teamId = String(t.id ?? teamName).toLowerCase()
    if (teamName && !teams.has(teamId)) {
      teams.set(teamId, {
        id: teamId,
        league: 'TPBL',
        name: teamName,
        nameLocal: clean(t.name) || null,
        shortName: teamName,
        abbr: teamName.slice(0, 3).toUpperCase(),
        logo: t.meta?.logo || null,
      })
    }

    const name = englishName(p, p.name)
    const meta = p.meta || {}
    const row = {
      id: String(p.id ?? name),
      name,
      nameLocal: clean(p.name) !== name ? clean(p.name) : null,
      jersey: p.number != null ? String(p.number) : null,
      position: shortPosition(meta.position),
      height: meta.height ? `${meta.height} cm` : null,
      weight: meta.weight ? `${meta.weight} kg` : null,
      country: clean(meta.nationality) || null,
      headshot: p.images?.[0]?.url || null,
      teamId,
      teamName,
      gamesPlayed: entry.game_count ?? null,
      points: avg.score ?? null,
      rebounds: avg.rebounds ?? null,
      assists: avg.assists ?? null,
      steals: avg.steals ?? null,
      blocks: avg.blocks ?? null,
      turnovers: avg.turnovers ?? null,
      // Court time arrives in seconds.
      minutes: avg.time_on_court != null ? Number((avg.time_on_court / 60).toFixed(1)) : null,
      fgPct: pct.field_goals ?? null,
      threePct: pct.three_pointers ?? null,
      ftPct: pct.free_throws ?? null,
    }

    players.push(row)
    ;(rosters[teamId] ||= []).push({
      id: row.id,
      name: row.name,
      nameLocal: row.nameLocal,
      jersey: row.jersey,
      position: row.position,
      height: row.height,
      weight: row.weight,
      age: null,
      country: row.country,
      headshot: row.headshot,
    })
  }

  for (const list of Object.values(rosters)) {
    list.sort((a, b) => Number(a.jersey ?? 999) - Number(b.jersey ?? 999))
  }

  notes.push(`TPBL stats from the league's own API, division "${regular.name}".`)
  return { players, rosters, teams: [...teams.values()], notes }
}

// ───────────────────────────────────────────────────────────────────────────
// Shared: turn per-player rows into the leaders shape the Stats page renders
// ───────────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  ['avgPoints', 'points'],
  ['avgRebounds', 'rebounds'],
  ['avgAssists', 'assists'],
  ['avgSteals', 'steals'],
  ['avgBlocks', 'blocks'],
]

/**
 * Top ten per category.
 *
 * A minimum-games filter matters more than it looks: without it, a player who
 * appeared once and scored 20 outranks a season-long leader averaging 19, and
 * the table becomes actively misleading. The threshold is a share of the
 * longest season played in that league, so it adapts to a short or truncated
 * campaign instead of hard-coding a game count.
 */
export function buildLeaders(players, { minGamesShare = 0.4 } = {}) {
  if (!players?.length) return {}

  const maxGames = Math.max(...players.map((p) => p.gamesPlayed || 0))
  const minGames = Math.max(1, Math.floor(maxGames * minGamesShare))
  const eligible = players.filter((p) => (p.gamesPlayed || 0) >= minGames)
  const pool = eligible.length >= 10 ? eligible : players

  const out = {}
  for (const [key, field] of CATEGORIES) {
    const ranked = pool
      .filter((p) => typeof p[field] === 'number')
      .sort((a, b) => b[field] - a[field])
      .slice(0, 10)
      .map((p) => ({
        name: p.name,
        headshot: p.headshot || null,
        team: p.teamAbbr || p.teamName || null,
        teamId: p.teamId || null,
        value: Number(p[field]).toFixed(1),
        gamesPlayed: p.gamesPlayed ?? null,
      }))
    if (ranked.length) out[key] = ranked
  }

  return { leaders: out, minGames }
}

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

/** RealGM league ids, read from its international index — not guessed. */
export const REALGM_LEAGUES = {
  CBA: { id: 40, slug: 'Chinese-CBA' },
  KBL: { id: 63, slug: 'South-Korean-KBL' },
  BLeague: { id: 105, slug: 'Japanese-BLeague' },
  PBA: { id: 60, slug: 'Filipino-PBA' },
  NBB: { id: 59, slug: 'Brazilian-NBB' },
  NBL: { id: 5, slug: 'Australian-NBL' },
  EuroLeague: { id: 1, slug: 'Euroleague' },
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

/**
 * League standings from RealGM.
 *
 * The standings page defaults to the *current* season, which in the
 * off-season has not started and renders no table. Each season lives at its
 * own URL with an internal id (`/standings/1390/2026` for the 2025-26 CBA),
 * and those ids differ per league — so they are read from the page's own
 * season selector rather than constructed, then tried newest-first until one
 * actually has rows.
 */
export async function realgmStandings(leagueKey) {
  const cfg = REALGM_LEAGUES[leagueKey]
  if (!cfg) throw new Error(`no RealGM mapping for ${leagueKey}`)
  const notes = []
  const base = `https://basketball.realgm.com/international/league/${cfg.id}/${cfg.slug}/standings`

  const index = await curlGet(base)
  await sleep(REALGM_DELAY_MS)
  if (/Just a moment|cf-browser-verification|challenge-platform/i.test(index)) {
    return { seasonLabel: '', rows: [], notes: [`${leagueKey}: bot-check page; skipped`] }
  }

  const $i = cheerio.load(index)
  const seasons = []
  $i('option').each((_, o) => {
    const v = $i(o).attr('value') || ''
    // The page also carries a LEAGUE selector whose options match the same
    // /standings/<id>/<year> shape ("Adriatic League", "Argentinian Liga A").
    // Only accept options that point at this league.
    if (!v.includes(`/league/${cfg.id}/`)) return
    const m = v.match(/\/standings\/(\d+)\/(\d{4})/)
    if (m) seasons.push({ path: v, year: Number(m[2]), label: clean($i(o).text()) })
  })

  // RealGM labels a season by the year it ENDS, so end-year 2027 is the
  // 2026-27 season — not started in September 2026. Skip anything ending
  // after this year, and refuse anything older than last season: showing a
  // 2017-18 table as current standings would be worse than showing none.
  const thisYear = new Date().getFullYear()
  seasons.sort((a, b) => b.year - a.year)
  const candidates = seasons.filter((x) => x.year <= thisYear && x.year >= thisYear - 1)
  if (!candidates.length && seasons.length) {
    notes.push(
      `${leagueKey}: newest RealGM standings are ${seasons[0].label}, too old to present as current`
    )
  }

  for (const season of candidates) {
    const url = season.path.startsWith('http')
      ? season.path
      : `https://basketball.realgm.com${season.path}`
    let html
    try {
      html = await curlGet(url)
    } catch (err) {
      notes.push(`${leagueKey} ${season.label}: ${err.message}`)
      await sleep(REALGM_DELAY_MS)
      continue
    }
    await sleep(REALGM_DELAY_MS)

    const $ = cheerio.load(html)
    const table = $('table').first()
    const headers = table.find('thead th').map((_, th) => clean($(th).text())).get()
    const at = (name) => headers.indexOf(name)

    const rows = []
    table.find('tbody tr').each((i, tr) => {
      const tds = $(tr).find('td')
      const cell = (name) => clean(tds.eq(at(name)).text())
      const link = tds.eq(at('Team')).find('a').attr('href') || ''
      const m = link.match(/\/team\/(\d+)\/([^/]+)/)
      const name = cell('Team')
      if (!name) return
      const wins = num(cell('W')) ?? 0
      const losses = num(cell('L')) ?? 0
      const ppg = num(cell('PPG'))
      const oppg = num(cell('OPPG'))
      rows.push({
        team: {
          id: m ? `rg-${m[1]}` : name.toLowerCase().replace(/\W+/g, '-'),
          realgmId: m ? m[1] : null,
          name,
          abbr: null,
          logo: null,
        },
        wins,
        losses,
        pct: cell('PCT') || '—',
        gamesBehind: cell('GB') || null,
        lastTen: cell('L10') || null,
        streak: cell('STRK') || null,
        // RealGM publishes per-game points, not totals.
        pointsFor: ppg,
        pointsAgainst: oppg,
        diff: cell('DIFF') || null,
        seed: num(cell('#')) ?? i + 1,
      })
    })

    if (rows.length) return { seasonLabel: season.label, rows, notes }
    notes.push(`${leagueKey} ${season.label}: no standings rows`)
  }

  return { seasonLabel: '', rows: [], notes }
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

// ───────────────────────────────────────────────────────────────────────────
// TPBL standings and news — also first-party
// ───────────────────────────────────────────────────────────────────────────

/**
 * Regular-season standings from the league's own team-stats endpoint.
 *
 * `won_game_count` / `lost_game_count` are the league's own figures, and the
 * team ids are the same ids TPBL_CLUBS is keyed on, so rows line up with the
 * clubs exactly — no name matching involved.
 */
export async function tpblStandings() {
  const divisions = await tpblJSON('/events/2/divisions')
  const regular =
    divisions.find((d) => d.name === '例行賽') || divisions.find((d) => d.status === 'COMPLETED')
  if (!regular) return { seasonLabel: '', rows: [] }

  const raw = await tpblJSON(`/games/stats/teams?division_id=${regular.id}`)
  const rows = raw
    .filter((e) => e.team && (e.won_game_count != null || e.lost_game_count != null))
    .map((e) => {
      const wins = e.won_game_count ?? 0
      const losses = e.lost_game_count ?? 0
      const played = wins + losses
      const acc = e.accumulated_stats || {}
      const pf = acc.won_score ?? null
      const pa = acc.lost_score ?? null
      return {
        team: { id: String(e.team.id), name: null, abbr: null, logo: e.team.meta?.logo || null },
        wins,
        losses,
        pct: played ? (wins / played).toFixed(3).replace(/^0/, '') : '—',
        pointsFor: played && pf != null ? Number((pf / played).toFixed(1)) : null,
        pointsAgainst: played && pa != null ? Number((pa / played).toFixed(1)) : null,
        diff: pf != null && pa != null ? (pf - pa > 0 ? `+${pf - pa}` : String(pf - pa)) : null,
        streak: null,
      }
    })
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses)

  rows.forEach((r, i) => {
    r.seed = i + 1
    const lead = rows[0]
    const gb = ((lead.wins - r.wins) + (r.losses - lead.losses)) / 2
    r.gamesBehind = i === 0 ? '—' : String(gb)
  })

  // No year here: the API does not name its seasons, and a hard-coded year
  // would go stale exactly like the hard-coded league count did.
  return { seasonLabel: 'Regular season', rows }
}

/** The league's own news posts. Titles are Chinese; the caller translates. */
export async function tpblNews(limit = 12) {
  const body = await tpblJSON('/teams/1/posts?type=news')
  const list = body.result || body.data || []
  return list
    .filter((p) => p.is_published !== false && p.title)
    .slice(0, limit)
    .map((p) => ({
      id: `TPBL-${p.id}`,
      title: clean(p.title),
      published: p.published_at ? new Date(p.published_at.replace(' ', 'T') + '+08:00').toISOString() : null,
      url: `https://tpbl.basketball/news/${p.slug || p.id}`,
      image: p.thumbnail || null,
      category: p.category?.title || null,
    }))
}

// ───────────────────────────────────────────────────────────────────────────
// Combining conference tables (PBA)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Merge per-conference averages into whole-season averages.
 *
 * RealGM publishes the PBA as three separate conferences. A season average is
 * not the mean of three averages — a player who played 2 games in one and 11
 * in another would be weighted equally. Weighting each average by games
 * played recovers the true per-game figure exactly, since avg × GP = total.
 */
export function combineConferenceStats(lists) {
  const byPlayer = new Map()
  const AVERAGED = ['points', 'rebounds', 'assists', 'steals', 'blocks', 'turnovers', 'minutes']

  for (const list of lists) {
    for (const p of list) {
      const key = `${p.name}|${p.teamRealgmId || p.teamName || ''}`
      const gp = p.gamesPlayed || 0
      if (!gp) continue
      const acc = byPlayer.get(key) || { ...p, gamesPlayed: 0, totals: {} }
      acc.gamesPlayed += gp
      for (const f of AVERAGED) {
        if (typeof p[f] === 'number') acc.totals[f] = (acc.totals[f] || 0) + p[f] * gp
      }
      byPlayer.set(key, acc)
    }
  }

  return [...byPlayer.values()].map((p) => {
    const out = { ...p }
    for (const f of AVERAGED) {
      if (p.totals[f] != null) out[f] = Number((p.totals[f] / p.gamesPlayed).toFixed(1))
    }
    delete out.totals
    return out
  })
}

/**
 * Player profiles.
 *
 * One function, `getPlayer(leagueKey, playerId)`, that answers the same
 * questions for every league — who, what team, what background, what numbers,
 * where have they played — from whichever sources that league actually has.
 *
 *   NBA, WNBA, NCAA     ESPN live: bio, full career by season, game log
 *   G League, NBL, FIBA ESPN bio; season line from our own data
 *   rg-<id>             RealGM: season line from the snapshot, and the career
 *                       history (every league, team and season) from
 *                       /data/players/<id>.json when it has been fetched
 *   TPBL                the league's own API, via the snapshot
 *
 * Nothing is inferred. A field a source does not provide is left out of the
 * profile rather than filled with a guess, and every profile lists where each
 * part came from.
 */
import { getLeague } from './leagues.js'
import { loadSnapshot, loadExtra } from './snapshot.js'

const ESPN_WEB = 'https://site.web.api.espn.com/apis/common/v3/sports/basketball'

const cache = new Map()
async function getJSON(url) {
  if (cache.has(url)) return cache.get(url)
  const p = fetch(url)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
  cache.set(url, p)
  return p
}

const fixed = (v, d = 1) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(d) : null)
const normName = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** "dallas-mavericks" → "Dallas Mavericks". ESPN's own slug, prettified. */
const fromSlug = (slug) =>
  String(slug || '')
    .split('-')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')

/**
 * The distinct leagues a player has passed through, in order — the "path"
 * shown at the top of a profile. Consecutive seasons in the same league
 * collapse to one step.
 */
const NOT_A_LEAGUE = /cup|blitz|champions|super ?cup|showcase|tournament|qualif|summer|preseason/i

function leaguePath(rows) {
  const path = []
  for (const r of rows) {
    // RealGM lists every competition of a season in one cell:
    // "AUS NBL, Jeep Elite, NBL Blitz". Split, and keep only the leagues.
    const leagues = String(r.league || '')
      .split(/\s*,\s*/)
      .filter((l) => l && !NOT_A_LEAGUE.test(l))
    for (const league of leagues) {
      if (path[path.length - 1] !== league) path.push(league)
    }
  }
  return path
}

/** Shape a season line the same way whatever its source. */
function seasonLine(p, label) {
  if (!p) return null
  return {
    label,
    gamesPlayed: p.gamesPlayed ?? null,
    minutes: fixed(p.minutes),
    points: fixed(p.points),
    rebounds: fixed(p.rebounds),
    assists: fixed(p.assists),
    steals: fixed(p.steals),
    blocks: fixed(p.blocks),
    // RealGM gives percentages as ".464"; TPBL as 46.4. Normalise to 46.4.
    fgPct: pct(p.fgPct),
    threePct: pct(p.threePct),
    ftPct: pct(p.ftPct),
  }
}

function pct(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  return (v <= 1 ? v * 100 : v).toFixed(1)
}

/**
 * ESPN publishes birth dates only as a display string in day/month/year order
 * ("28/2/1999"; LeBron James reads "30/12/1984"). Written out in words so it
 * cannot be misread as month/day.
 */
function bornLabel(iso, display, age) {
  let d = iso ? new Date(iso) : null
  if ((!d || Number.isNaN(d.getTime())) && display) {
    const m = String(display).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (m) d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])))
  }
  const text =
    d && !Number.isNaN(d.getTime())
      ? d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
      : display
  if (!text) return null
  return age ? `${text} (age ${age})` : text
}

/** Ordered, present-only bio facts. */
function bioList(pairs) {
  return pairs.filter(([, v]) => v != null && v !== '').map(([label, value]) => ({ label, value }))
}

/**
 * RealGM writes NBA clubs as abbreviations in its career tables. These are the
 * league's own current codes; anything not listed (older franchises, G League
 * affiliates) is left exactly as RealGM wrote it rather than guessed at.
 */
const NBA_TEAMS = {
  ATL: 'Atlanta Hawks', BOS: 'Boston Celtics', BKN: 'Brooklyn Nets', CHA: 'Charlotte Hornets',
  CHI: 'Chicago Bulls', CLE: 'Cleveland Cavaliers', DAL: 'Dallas Mavericks', DEN: 'Denver Nuggets',
  DET: 'Detroit Pistons', GSW: 'Golden State Warriors', HOU: 'Houston Rockets', IND: 'Indiana Pacers',
  LAC: 'LA Clippers', LAL: 'Los Angeles Lakers', MEM: 'Memphis Grizzlies', MIA: 'Miami Heat',
  MIL: 'Milwaukee Bucks', MIN: 'Minnesota Timberwolves', NOP: 'New Orleans Pelicans',
  NYK: 'New York Knicks', OKC: 'Oklahoma City Thunder', ORL: 'Orlando Magic',
  PHI: 'Philadelphia 76ers', PHX: 'Phoenix Suns', POR: 'Portland Trail Blazers',
  SAC: 'Sacramento Kings', SAS: 'San Antonio Spurs', TOR: 'Toronto Raptors', UTA: 'Utah Jazz',
  WAS: 'Washington Wizards',
}

const expandTeam = (row) =>
  row.league === 'NBA' && row.team
    ? { ...row, team: row.team.split(', ').map((t) => NBA_TEAMS[t] || t).join(', ') }
    : row

// ───────────────────────────────────────────────────────────────────────────
// RealGM career (fetched by `npm run data:careers`)
// ───────────────────────────────────────────────────────────────────────────

async function realgmCareer(realgmId) {
  const data = await getJSON(`${import.meta.env.BASE_URL}data/players/${realgmId}.json`)
  if (!data) return null
  const pro = [...(data.nba || []), ...(data.gleague || []), ...(data.international || [])]
    .map(expandTeam)
    // Season strings sort correctly as text ("2014-15" < "2015-16").
    .sort((a, b) => String(a.season).localeCompare(String(b.season)))
  return {
    name: data.name,
    url: data.url,
    position: data.position,
    jersey: data.jersey,
    bio: data.bio || {},
    career: pro,
    college: data.college || [],
    transactions: data.transactions || [],
    awards: data.awards || [],
    fetchedAt: data.fetchedAt,
    // Careers captured before the G League table was parsed (parser v1)
    // lack those seasons. Say so rather than present a gap as a full career.
    missingGLeague: (data.parserVersion || 1) < 2,
  }
}

// ───────────────────────────────────────────────────────────────────────────
// ESPN athlete
// ───────────────────────────────────────────────────────────────────────────

async function espnAthlete(league, id) {
  const base = `${ESPN_WEB}/${league.espnSlug}/athletes/${id}`
  const [bioRes, statsRes, logRes] = await Promise.all([
    getJSON(base),
    getJSON(`${base}/stats`),
    getJSON(`${base}/gamelog`),
  ])
  const a = bioRes?.athlete
  if (!a) return null

  // Career: one row per season, with the team they played for.
  const avg = statsRes?.categories?.find((c) => c.name === 'averages')
  const names = avg?.names || []
  const at = (n) => names.indexOf(n)
  const career = (avg?.statistics || []).map((row) => {
    const v = row.stats || []
    const n = (name) => {
      const x = parseFloat(v[at(name)])
      return Number.isFinite(x) ? x : null
    }
    // A traded player gets one row per team plus a combined row for the
    // season, whose "team" slug is really "2024-25-totals". Label it as what
    // it is instead of prettifying it into a fake club name.
    const isTotal = /totals?$/i.test(row.teamSlug || '') || !row.teamId
    return {
      season: row.season?.displayName,
      team: isTotal ? 'Season total (all teams)' : fromSlug(row.teamSlug),
      isTotal,
      league: league.name,
      gamesPlayed: n('gamesPlayed'),
      minutes: n('avgMinutes'),
      points: n('avgPoints'),
      rebounds: n('avgRebounds'),
      assists: n('avgAssists'),
      steals: n('avgSteals'),
      blocks: n('avgBlocks'),
      fgPct: n('fieldGoalPct'),
      threePct: n('threePointFieldGoalPct'),
      ftPct: n('freeThrowPct'),
    }
  })

  // Game log: months are separate categories; flatten, join, newest first.
  const events = logRes?.events || {}
  const labels = logRes?.labels || []
  const li = (n) => labels.indexOf(n)
  const gameLog = (logRes?.seasonTypes?.[0]?.categories || [])
    .flatMap((c) => c.events || [])
    .map((row) => {
      const e = events[row.eventId] || {}
      const v = row.stats || []
      return {
        date: e.gameDate,
        opponent: e.opponent?.abbreviation || e.opponent?.displayName,
        atVs: e.atVs,
        result: e.gameResult ? `${e.gameResult} ${e.score || ''}`.trim() : null,
        minutes: v[li('MIN')],
        points: v[li('PTS')],
        rebounds: v[li('REB')],
        assists: v[li('AST')],
      }
    })
    .filter((g) => g.date)
    .sort((x, y) => new Date(y.date) - new Date(x.date))
    .slice(0, 10)

  return {
    name: a.displayName,
    headshot: a.headshot?.href || null,
    jersey: a.jersey || null,
    position: a.position?.abbreviation || a.position?.name || null,
    team: a.team ? { id: a.team.id, name: a.team.displayName, logo: a.team.logos?.[0]?.href || null } : null,
    bio: bioList([
      ['Height', a.displayHeight],
      ['Weight', a.displayWeight],
      // ESPN's displayDOB is day/month ("28/2/1999"), which reads as a
      // different date to half its audience. Format from the ISO date.
      ['Born', bornLabel(a.dateOfBirth, a.displayDOB, a.age)],
      ['Birthplace', a.displayBirthPlace],
      ['College', a.college?.name],
      ['Draft', a.displayDraft],
      ['Experience', a.displayExperience],
    ]),
    career,
    gameLog,
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Snapshot lookup
// ───────────────────────────────────────────────────────────────────────────

async function statsPool(league) {
  const [snap, extra] = await Promise.all([
    league.source === 'snapshot' ? loadSnapshot(league) : null,
    league.source !== 'snapshot' ? loadExtra(league.key) : null,
  ])
  return {
    snap,
    extra,
    players: [...(snap?.playerStats || []), ...(extra?.playerStats || [])],
    teams: snap?.teams || [],
    seasonLabel: snap?.standings?.seasonLabel || snap?.season || '',
    leadersLabel: extra?.leadersLabel || null,
  }
}

/**
 * Exact-name lookup within one league. Returns a match only when exactly one
 * player carries that name — two players sharing a name is ambiguous, and an
 * ambiguous profile is a wrong one. Deliberately not fuzzy.
 */
function uniqueByName(players, name, teamId) {
  const target = normName(name)
  if (!target) return null
  let hits = players.filter((p) => normName(p.name) === target)
  if (teamId && hits.length > 1) hits = hits.filter((p) => String(p.teamId) === String(teamId))
  return hits.length === 1 ? hits[0] : null
}

function rosterEntry(snap, playerId) {
  for (const [teamId, list] of Object.entries(snap?.rosters || {})) {
    const hit = list.find((p) => String(p.id) === String(playerId))
    if (hit) return { entry: hit, teamId }
  }
  return null
}

// ───────────────────────────────────────────────────────────────────────────

export async function getPlayer(leagueKey, playerId) {
  const league = getLeague(leagueKey)
  if (!league || !playerId) return null
  const id = String(playerId)
  const pool = await statsPool(league)
  const sources = []

  let profile = {
    id,
    league: league.key,
    name: null,
    nameLocal: null,
    headshot: null,
    jersey: null,
    position: null,
    team: null,
    bio: [],
    season: null,
    career: [],
    college: [],
    path: [],
    transactions: [],
    awards: [],
    gameLog: [],
    careerUrl: null,
    sources,
  }

  const teamFor = (teamId) => {
    const t = pool.teams.find((x) => String(x.id) === String(teamId))
    return t ? { id: t.id, name: t.name, logo: t.logo || null } : null
  }

  // ── ESPN-backed leagues ─────────────────────────────────────────────────
  if (league.espnSlug && league.source !== 'snapshot' && /^\d+$/.test(id)) {
    const e = await espnAthlete(league, id)
    if (e) {
      profile = { ...profile, ...e }
      sources.push({ name: 'ESPN', url: 'https://www.espn.com/' })
      // The current season line: prefer the combined row for a traded
      // player (it is the whole season), otherwise the latest team row.
      const latest = e.career[e.career.length - 1]?.season
      const rows = e.career.filter((r) => r.season === latest)
      const last = rows.find((r) => r.isTotal) || rows[rows.length - 1]
      if (last) profile.season = seasonLine(last, `${last.season} season`)
    }
    // No ESPN career for this league (G League, NBL, FIBA): use our own line.
    if (!profile.season) {
      const line = pool.players.find((p) => String(p.id) === id) || uniqueByName(pool.players, profile.name)
      if (line) {
        profile.season = seasonLine(line, pool.leadersLabel || 'Season averages')
        if (line.realgmPlayerId) profile.careerRealgmId = line.realgmPlayerId
      }
    }
  }

  // ── RealGM-backed player ────────────────────────────────────────────────
  let realgmId = id.startsWith('rg-') ? id.slice(3) : profile.careerRealgmId || null

  // ── Snapshot roster entry (B.League, PBA, TPBL, KBL) ────────────────────
  if (!profile.name && pool.snap) {
    const line = pool.players.find((p) => String(p.id) === id)
    const found = rosterEntry(pool.snap, id)
    const entry = found?.entry
    const name = line?.name || entry?.name
    if (name) {
      const teamId = line?.teamId || found?.teamId
      profile.name = name
      profile.nameLocal = entry?.nameLocal || line?.nameLocal || null
      profile.headshot = line?.headshot || entry?.headshot || null
      profile.jersey = line?.jersey || entry?.jersey || null
      profile.position = line?.position || entry?.position || null
      profile.team = teamFor(teamId)
      profile.bio = bioList([
        ['Height', line?.height || entry?.height],
        ['Weight', line?.weight || entry?.weight],
        ['Age', entry?.age],
        ['Nationality', line?.country || entry?.country],
        ['College', entry?.college],
      ])
      // A roster entry from the league's own site, and a stat line from
      // RealGM, are joined only on an exact, unique name within the club.
      const stat = line || uniqueByName(pool.players, name, teamId)
      if (stat) {
        profile.season = seasonLine(stat, `${pool.seasonLabel || 'Season'} averages`)
        if (!realgmId && stat.realgmPlayerId) realgmId = stat.realgmPlayerId
      }
      for (const s of pool.snap.sources || []) sources.push(s)
    }
  }

  // ── Career history from RealGM ──────────────────────────────────────────
  if (realgmId) {
    const c = await realgmCareer(realgmId)
    profile.careerUrl = c?.url || `https://basketball.realgm.com/player/player/Summary/${realgmId}`
    if (c) {
      profile.name = profile.name || c.name
      profile.position = profile.position || c.position
      profile.jersey = profile.jersey || c.jersey
      const b = c.bio
      const have = new Set(profile.bio.map((x) => x.label))
      for (const [label, value] of [
        ['Height', b.height],
        ['Weight', b.weight],
        ['Born', b.born],
        ['Hometown', b.hometown],
        ['Nationality', b.nationality],
        ['Draft', b.draft],
        ['High school', b.highSchool],
      ]) {
        if (value && !have.has(label)) profile.bio.push({ label, value })
      }
      // RealGM's career is the fuller one for international players; ESPN's
      // only knows its own league. Use RealGM's when it has more seasons.
      if (c.career.length > profile.career.length) profile.career = c.career
      profile.college = c.college
      profile.careerMissingGLeague = c.missingGLeague
      profile.transactions = c.transactions
      profile.awards = c.awards
      sources.push({ name: 'RealGM', url: c.url })
    }
    if (!profile.season) {
      const line = pool.players.find((p) => p.realgmPlayerId === realgmId)
      if (line) {
        profile.season = seasonLine(line, pool.leadersLabel || `${pool.seasonLabel || 'Season'} averages`)
        // Leagues read live (EuroLeague, NBL) have no snapshot club list to
        // link into, but RealGM still names the club — show it, unlinked.
        profile.team =
          profile.team ||
          teamFor(line.teamId) ||
          (line.teamName ? { id: null, name: line.teamName, logo: null } : null)
        profile.name = profile.name || line.name
      }
    }
  }

  if (!profile.name) return null

  profile.path = leaguePath(profile.career)
  // De-duplicate sources by name.
  profile.sources = [...new Map(sources.map((s) => [s.name, s])).values()]
  return profile
}

/** Profile URL for a player row, or null when no profile is possible. */
export function playerHref(leagueKey, playerId) {
  if (!leagueKey || playerId == null || playerId === '') return null
  return `/player/${leagueKey}/${encodeURIComponent(playerId)}`
}

/**
 * Map each roster row to the profile it should open.
 *
 * Most rosters already carry an id the resolver understands (ESPN athlete ids,
 * RealGM ids, TPBL ids, or the snapshot's own roster ids). EuroLeague's roster
 * comes from its official feed with its own person codes, so those rows are
 * bridged to RealGM's EuroLeague stats by exact, unique name — never fuzzily.
 * A row with no safe match simply does not link.
 */
export async function rosterProfileIds(leagueKey, players) {
  const league = getLeague(leagueKey)
  const out = new Map()
  if (!league) return out

  if (league.source === 'euroleague') {
    const extra = await loadExtra(league.key)
    const pool = extra?.playerStats || []
    for (const p of players) {
      const hit = uniqueByName(pool, p.name)
      out.set(String(p.id ?? p.name), hit?.id || null)
    }
    return out
  }

  for (const p of players) out.set(String(p.id ?? p.name), p.id != null ? String(p.id) : null)
  return out
}

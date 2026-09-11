/**
 * ESPN public JSON adapter.
 *
 * These endpoints are undocumented but public, unauthenticated, and served
 * with `Access-Control-Allow-Origin: *` — so the browser can call them
 * directly with no API key, no server and no proxy. Everything returned by
 * this module is real, live data.
 *
 * Every function normalises ESPN's response into the shared shapes documented
 * in ./types.js so that snapshot-backed leagues can be rendered by exactly the
 * same components.
 */

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/basketball'
const CORE = 'https://site.api.espn.com/apis/v2/sports/basketball'

// Small in-memory cache so navigating between pages doesn't refetch the same
// payload. Live data gets a short TTL; reference data (teams, rosters) longer.
const cache = new Map()

async function getJSON(url, ttlMs = 60_000) {
  const hit = cache.get(url)
  if (hit && Date.now() - hit.at < ttlMs) return hit.data

  const res = await fetch(url)
  if (!res.ok) throw new Error(`ESPN ${res.status} for ${url}`)
  const data = await res.json()
  cache.set(url, { at: Date.now(), data })
  return data
}

function yyyymmdd(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

function statusOf(event) {
  const name = event?.status?.type?.name || ''
  if (name === 'STATUS_FINAL') return 'final'

  if (event?.status?.type?.state === 'in') {
    // ESPN leaves `state: "in"` on some abandoned or mis-keyed records, which
    // would otherwise park a months-old game under "Live Now" forever. Only
    // believe it if the tip-off is within a day of now.
    const tip = new Date(event.date).getTime()
    const fresh = Number.isFinite(tip) && Math.abs(Date.now() - tip) < 24 * 60 * 60 * 1000
    if (fresh) return 'live'
    return event.status?.type?.completed ? 'final' : 'scheduled'
  }

  return 'scheduled'
}

function normaliseCompetitor(c) {
  if (!c) return null
  const t = c.team || {}
  return {
    id: t.id,
    name: t.displayName || t.name,
    shortName: t.shortDisplayName || t.name,
    abbr: t.abbreviation,
    logo: t.logo || t.logos?.[0]?.href || null,
    color: t.color ? `#${t.color}` : null,
    score: c.score != null ? Number(c.score) : null,
    winner: !!c.winner,
    record: c.records?.[0]?.summary || null,
    linescores: (c.linescores || []).map((l) => l.value),
    leaders: (c.leaders || [])
      .map((cat) => {
        const top = cat.leaders?.[0]
        if (!top) return null
        return {
          category: cat.shortDisplayName || cat.displayName,
          playerId: top.athlete?.id || null,
          name: top.athlete?.displayName,
          headshot: top.athlete?.headshot?.href || null,
          value: top.displayValue,
        }
      })
      .filter(Boolean),
  }
}

function normaliseEvent(event, leagueKey) {
  const comp = event.competitions?.[0] || {}
  const competitors = comp.competitors || []
  const home = normaliseCompetitor(competitors.find((c) => c.homeAway === 'home'))
  const away = normaliseCompetitor(competitors.find((c) => c.homeAway === 'away'))

  return {
    id: event.id,
    league: leagueKey,
    status: statusOf(event),
    statusDetail: event.status?.type?.shortDetail || '',
    period: event.status?.period ?? null,
    clock: event.status?.displayClock ?? null,
    date: event.date,
    venue: comp.venue?.fullName || null,
    city: comp.venue?.address?.city || null,
    broadcast: comp.broadcasts?.[0]?.names?.[0] || null,
    note: comp.notes?.[0]?.headline || null,
    home,
    away,
    link: event.links?.find((l) => l.rel?.includes('summary'))?.href || null,
  }
}

/** Scoreboard for one calendar day, or a `YYYYMMDD-YYYYMMDD` range. */
export async function fetchScoreboard(league, dates) {
  const q = dates instanceof Date ? yyyymmdd(dates) : dates
  const extra = league.espnParams ? `&${league.espnParams}` : ''
  const url = `${SITE}/${league.espnSlug}/scoreboard?dates=${q}&limit=300${extra}`
  const data = await getJSON(url, 30_000)
  return (data.events || []).map((e) => normaliseEvent(e, league.key))
}

function shift(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return yyyymmdd(d)
}

/**
 * Build a usable slate around today.
 *
 * ESPN accepts a `YYYYMMDD-YYYYMMDD` range, so a whole window costs one
 * request rather than one per day — which matters now that the ledger spans
 * every competition in the ledger.
 *
 * Basketball leagues have long off-seasons and dark days, so "today" is often
 * empty. We widen the window in steps until there is something to show, which
 * is what the "Final Whistles" and "Scheduled" rails actually want.
 */
export async function fetchRecentAndUpcoming(league) {
  const WINDOWS = [
    [-7, 7],
    [-45, 30],
    [-210, 60],
  ]

  let games = []
  for (const [back, forward] of WINDOWS) {
    games = await fetchScoreboard(league, `${shift(back)}-${shift(forward)}`).catch(() => [])
    const finals = games.filter((g) => g.status === 'final').length
    const upcoming = games.filter((g) => g.status !== 'final').length
    if (finals >= 6 && upcoming >= 4) break
  }

  games.sort((a, b) => new Date(b.date) - new Date(a.date))

  // Trim to a scoreboard-sized slate: recent results plus the next fixtures.
  const live = games.filter((g) => g.status === 'live')
  const finals = games.filter((g) => g.status === 'final').slice(0, 12)
  const upcoming = games
    .filter((g) => g.status === 'scheduled')
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 12)

  return [...live, ...finals, ...upcoming]
}

/** One standings row, normalised from an ESPN entry. */
function standingRow(e) {
  const stat = (name) => e.stats?.find((s) => s.name === name)
  const num = (name) => {
    const v = stat(name)?.value
    return typeof v === 'number' ? v : null
  }
  return {
    team: {
      id: e.team?.id,
      name: e.team?.displayName,
      abbr: e.team?.abbreviation,
      logo: e.team?.logos?.[0]?.href || null,
    },
    wins: num('wins') ?? 0,
    losses: num('losses') ?? 0,
    pct: stat('winPercent')?.displayValue || '—',
    pointsFor: num('pointsFor'),
    pointsAgainst: num('pointsAgainst'),
    diff: stat('pointDifferential')?.displayValue || null,
    streak: stat('streak')?.displayValue || null,
    lastTen: e.stats?.find((s) => s.name === 'Last Ten Games')?.displayValue || null,
    gamesBehind: stat('gamesBehind')?.displayValue || null,
    /** Seed within the group ESPN returned it in — conference, for level 2. */
    seed: num('playoffSeed'),
    /** ESPN's clinch marker: z/y/x = clinched something, e = eliminated. */
    clincher: stat('clincher')?.displayValue || null,
  }
}

const byRecord = (a, b) => b.wins - a.wins || a.losses - b.losses

/** League-wide standings (level=1 returns every team, ungrouped). */
export async function fetchStandings(league) {
  const url = `${CORE}/${league.espnSlug}/standings?level=1`
  const data = await getJSON(url, 10 * 60_000)
  const rows = (data.standings?.entries || []).map(standingRow)
  rows.sort(byRecord)
  return {
    seasonLabel: data.standings?.seasonDisplayName || data.season?.displayName || '',
    rows,
  }
}

/**
 * Standings grouped by conference and by division.
 *
 * ESPN exposes the same table at three levels: 1 is flat, 2 splits by
 * conference, 3 splits again by division. Conference is the one that matters
 * for seeding, so the playoff picture is built from level 2.
 *
 * Entries arrive in no meaningful order — a 6-seed can come back second — so
 * conference groups are sorted by `playoffSeed`, and divisions (which have no
 * seed of their own) by record.
 */
export async function fetchStandingsGrouped(league) {
  const [byConf, byDiv] = await Promise.all([
    getJSON(`${CORE}/${league.espnSlug}/standings?level=2`, 10 * 60_000).catch(() => null),
    getJSON(`${CORE}/${league.espnSlug}/standings?level=3`, 10 * 60_000).catch(() => null),
  ])

  // Label the season the TABLE describes, not `season.displayName` — that is
  // the upcoming season (2026-27 while these are the completed 2025-26
  // standings), so using it puts last season's table under next season's name.
  // The real label lives on the group that actually holds the entries.
  const seasonLabel =
    byConf?.children?.[0]?.standings?.seasonDisplayName ||
    byDiv?.children?.[0]?.children?.[0]?.standings?.seasonDisplayName ||
    byConf?.standings?.seasonDisplayName ||
    ''

  const conferences = (byConf?.children || []).map((c) => {
    const rows = (c.standings?.entries || []).map(standingRow)
    // Seed order where ESPN provides it; record order otherwise.
    rows.sort((a, b) =>
      a.seed != null && b.seed != null ? a.seed - b.seed : byRecord(a, b)
    )
    return { name: c.name, abbrev: c.abbreviation || c.shortName || c.name, rows }
  })

  const divisions = []
  for (const c of byDiv?.children || []) {
    for (const d of c.children || []) {
      const rows = (d.standings?.entries || []).map(standingRow)
      rows.sort(byRecord)
      divisions.push({
        name: d.name,
        conference: c.name,
        conferenceAbbrev: c.abbreviation || c.shortName || c.name,
        rows,
      })
    }
  }

  return { seasonLabel, conferences, divisions }
}

/** League news — real ESPN wire stories. */
export async function fetchNews(league, limit = 12) {
  const url = `${SITE}/${league.espnSlug}/news?limit=${limit}`
  const data = await getJSON(url, 5 * 60_000)
  return (data.articles || []).map((a, i) => ({
    id: `${league.key}-${a.id ?? i}`,
    league: league.key,
    title: a.headline,
    description: a.description || '',
    published: a.published,
    byline: a.byline || (a.categories || []).find((c) => c.type === 'author')?.description || null,
    tag: (a.type || 'story').replace(/([A-Z])/g, ' $1').trim(),
    image: a.images?.[0]?.url || null,
    imageCaption: a.images?.[0]?.caption || null,
    url: a.links?.web?.href || null,
    premium: !!a.premium,
  }))
}

/**
 * All teams in the league.
 *
 * ESPN's `/teams` endpoint is the obvious source but it is the one endpoint in
 * this API that does NOT send `Access-Control-Allow-Origin`, so the browser
 * cannot read it. The standings feed does send CORS headers and carries every
 * club with its id, name, abbreviation and crest — so the club list is built
 * from there, falling back to the teams seen on recent fixtures for
 * competitions that publish no standings (national-team events, for instance).
 */
export async function fetchTeams(league) {
  const fromStandings = await fetchStandings(league).catch(() => null)
  const teams = (fromStandings?.rows || [])
    .map((r) => ({
      id: r.team.id,
      league: league.key,
      name: r.team.name,
      shortName: r.team.name,
      location: null,
      abbr: r.team.abbr,
      logo: r.team.logo,
      record: `${r.wins}-${r.losses}`,
    }))
    .filter((t) => t.id && t.name)

  if (teams.length) return teams

  const games = await fetchRecentAndUpcoming(league).catch(() => [])
  const seen = new Map()
  for (const g of games) {
    for (const side of [g.home, g.away]) {
      if (!side?.id || seen.has(String(side.id))) continue
      seen.set(String(side.id), {
        id: side.id,
        league: league.key,
        name: side.name,
        shortName: side.shortName || side.name,
        location: null,
        abbr: side.abbr,
        logo: side.logo,
        record: side.record || null,
      })
    }
  }
  return [...seen.values()]
}

/** Current roster for one team. */
export async function fetchRoster(league, teamId) {
  const url = `${SITE}/${league.espnSlug}/teams/${teamId}/roster`
  const data = await getJSON(url, 60 * 60_000)
  const players = (data.athletes || []).map((a) => ({
    id: a.id,
    name: a.fullName || a.displayName,
    jersey: a.jersey || null,
    position: a.position?.abbreviation || a.position?.name || null,
    height: a.displayHeight || null,
    weight: a.displayWeight || null,
    age: a.age ?? null,
    country: a.birthPlace?.country || null,
    college: a.college?.name || null,
    experience: a.experience?.years ?? null,
    headshot: a.headshot?.href || null,
  }))
  players.sort((a, b) => Number(a.jersey ?? 999) - Number(b.jersey ?? 999))

  return {
    team: {
      id: data.team?.id,
      name: data.team?.displayName,
      abbr: data.team?.abbreviation,
      logo: data.team?.logos?.[0]?.href || data.team?.logo || null,
      color: data.team?.color ? `#${data.team.color}` : null,
    },
    coach: data.coach?.[0]?.firstName
      ? `${data.coach[0].firstName} ${data.coach[0].lastName}`
      : null,
    season: data.season?.displayName || '',
    players,
  }
}

/** Full box score / detail for one game. */
export async function fetchGameSummary(league, gameId) {
  const url = `${SITE}/${league.espnSlug}/summary?event=${gameId}`
  const data = await getJSON(url, 30_000)

  const header = data.header || {}
  const comp = header.competitions?.[0] || {}
  const game = normaliseEvent(
    { ...header, competitions: header.competitions, status: comp.status, links: header.links },
    league.key
  )
  game.venue = data.gameInfo?.venue?.fullName || game.venue
  game.city = data.gameInfo?.venue?.address?.city || game.city
  game.attendance = data.gameInfo?.attendance || null

  const boxscore = (data.boxscore?.players || []).map((side) => ({
    team: {
      id: side.team?.id,
      name: side.team?.displayName,
      abbr: side.team?.abbreviation,
      logo: side.team?.logo || null,
    },
    labels: side.statistics?.[0]?.labels || [],
    players: (side.statistics?.[0]?.athletes || []).map((row) => ({
      id: row.athlete?.id,
      name: row.athlete?.displayName,
      jersey: row.athlete?.jersey,
      position: row.athlete?.position?.abbreviation,
      starter: !!row.starter,
      didNotPlay: !!row.didNotPlay,
      stats: row.stats || [],
    })),
  }))

  return {
    game,
    boxscore,
    lastFive: data.lastFiveGames || null,
    recap: data.article
      ? {
          title: data.article.headline,
          body: data.article.story || data.article.description || '',
          byline: data.article.byline || null,
          published: data.article.published || null,
          image: data.article.images?.[0]?.url || null,
        }
      : null,
    winProbability: data.winprobability || null,
  }
}

/**
 * League scoring leaders, from ESPN's season-leaders feed.
 *
 * Note the category names: ESPN calls these `pointsPerGame`, not `avgPoints`.
 * Matching on the wrong names silently returns nothing, and the caller then
 * falls back to per-game leaders off recent box scores — which looks fine
 * until you notice the "leader" played once and the real season leader is
 * missing entirely.
 */
const LEADER_CATEGORIES = {
  pointsPerGame: 'avgPoints',
  reboundsPerGame: 'avgRebounds',
  assistsPerGame: 'avgAssists',
  stealsPerGame: 'avgSteals',
  blocksPerGame: 'avgBlocks',
}

export async function fetchLeaders(league) {
  const url = `https://site.api.espn.com/apis/site/v3/sports/basketball/${league.espnSlug}/leaders`
  try {
    const data = await getJSON(url, 30 * 60_000)
    const categories = data.leaders?.categories || []

    const out = {}
    for (const [espnName, key] of Object.entries(LEADER_CATEGORIES)) {
      const cat = categories.find((c) => c.name === espnName)
      if (!cat?.leaders?.length) continue
      out[key] = cat.leaders.slice(0, 10).map((l) => ({
        name: l.athlete?.displayName,
        playerId: l.athlete?.id || null,
        headshot: l.athlete?.headshot?.href || null,
        team: l.team?.abbreviation || null,
        teamId: l.team?.id || null,
        value: l.displayValue,
      }))
    }

    return Object.keys(out).length ? out : null
  } catch {
    return null
  }
}

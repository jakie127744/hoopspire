/**
 * EuroLeague official feed adapter.
 *
 * ESPN lists EuroLeague clubs but publishes no games or standings for the
 * competition, so EuroLeague is read from EuroLeague Basketball's own feeds
 * instead. Both are public and CORS-open, so the browser calls them directly:
 *
 *   feeds.incrowdsports.com  — games, clubs and squads as JSON
 *   api-live.euroleague.net  — standings as XML
 *
 * Everything is normalised into the same shapes as ./espn.js.
 */

const FEED = 'https://feeds.incrowdsports.com/provider/euroleague-feeds/v2/competitions/E/seasons'
const LIVE = 'https://api-live.euroleague.net/v1'

const cache = new Map()

async function get(url, ttlMs, asText = false) {
  const hit = cache.get(url)
  if (hit && Date.now() - hit.at < ttlMs) return hit.data
  const res = await fetch(url)
  if (!res.ok) throw new Error(`EuroLeague ${res.status} for ${url}`)
  const data = asText ? await res.text() : await res.json()
  cache.set(url, { at: Date.now(), data })
  return data
}

/**
 * EuroLeague season codes run E<startYear>, so 2026-27 is E2026. We pick the
 * most recent season that actually has games, so the site survives the summer
 * rollover without a code change.
 */
async function currentSeasonCode() {
  const year = new Date().getFullYear()
  for (const code of [`E${year}`, `E${year - 1}`]) {
    try {
      const d = await get(`${FEED}/${code}/games?limit=1`, 60 * 60_000)
      if (d.data?.length) return code
    } catch {
      /* fall through to the previous season */
    }
  }
  return `E${year - 1}`
}

function statusOf(g) {
  if (g.status === 'result' || g.played) return 'final'
  if (g.status === 'live' || g.status === 'inprogress') return 'live'
  return 'scheduled'
}

function side(s) {
  if (!s) return null
  const q = s.quarters || {}
  const linescores = ['q1', 'q2', 'q3', 'q4', 'ot1', 'ot2', 'ot3', 'ot4', 'ot5']
    .map((k) => q[k])
    .filter((v) => v != null)
  return {
    id: s.code,
    name: s.name,
    shortName: s.abbreviatedName || s.editorialName || s.name,
    abbr: s.tla || s.code,
    logo: s.imageUrls?.crest || null,
    score: s.score ?? null,
    record: null,
    linescores,
    leaders: [],
    coach: s.coach?.name || null,
  }
}

function normaliseGame(g, leagueKey) {
  const home = side(g.home)
  const away = side(g.away)
  const status = statusOf(g)
  return {
    id: g.code ?? g.identifier,
    league: leagueKey,
    status,
    statusDetail:
      status === 'final'
        ? 'Final'
        : status === 'live'
          ? `${g.remainingTime || ''} Q${g.quarter ?? ''}`.trim()
          : g.round?.name || 'Scheduled',
    period: g.quarter ?? null,
    clock: g.remainingTime ?? null,
    date: g.date,
    venue: g.venue?.name || null,
    city: g.venue?.address || null,
    broadcast: null,
    note: g.phaseType?.name || g.round?.name || null,
    home: home && { ...home, winner: (home.score ?? 0) > (away?.score ?? 0) },
    away: away && { ...away, winner: (away.score ?? 0) > (home?.score ?? 0) },
    link: null,
  }
}

export async function fetchRecentAndUpcoming(league) {
  const season = await currentSeasonCode()
  const data = await get(`${FEED}/${season}/games?limit=500`, 60_000)
  const games = (data.data || []).map((g) => normaliseGame(g, league.key))
  games.sort((a, b) => new Date(b.date) - new Date(a.date))

  const live = games.filter((g) => g.status === 'live')
  const finals = games.filter((g) => g.status === 'final').slice(0, 12)
  const upcoming = games
    .filter((g) => g.status === 'scheduled')
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 12)

  return [...live, ...finals, ...upcoming]
}

export async function fetchStandings(league) {
  const season = await currentSeasonCode()
  const xml = await get(`${LIVE}/standings?seasonCode=${season}`, 10 * 60_000, true)
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) return { seasonLabel: season, rows: [] }

  const text = (el, tag) => el.querySelector(tag)?.textContent?.trim() ?? ''
  const num = (el, tag) => {
    const v = parseInt(text(el, tag), 10)
    return Number.isNaN(v) ? null : v
  }

  const rows = [...doc.querySelectorAll('team')].map((t) => {
    const wins = num(t, 'wins') ?? 0
    const losses = num(t, 'losses') ?? 0
    const pf = num(t, 'pointsFavour')
    const pa = num(t, 'pointsAgainst')
    const played = wins + losses
    return {
      team: { id: text(t, 'code'), name: text(t, 'name'), abbr: text(t, 'code'), logo: null },
      wins,
      losses,
      pct: played ? (wins / played).toFixed(3).replace(/^0/, '') : '—',
      pointsFor: pf,
      pointsAgainst: pa,
      diff: pf != null && pa != null ? (pf - pa > 0 ? `+${pf - pa}` : String(pf - pa)) : null,
      streak: null,
      seed: num(t, 'ranking'),
    }
  })

  rows.sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99))
  return { seasonLabel: `EuroLeague ${season.slice(1)}`, rows }
}

export async function fetchTeams(league) {
  const season = await currentSeasonCode()
  const data = await get(`${FEED}/${season}/clubs?limit=100`, 60 * 60_000)
  return (data.data || []).map((c) => ({
    id: c.code,
    league: league.key,
    name: c.name,
    shortName: c.abbreviatedName || c.editorialName,
    abbr: c.tvCode || c.code,
    location: c.country?.name || null,
    city: c.country?.name || null,
    logo: c.images?.crest || null,
    color: null,
    website: c.website || null,
  }))
}

/** EuroLeague publishes names as "SURNAME, FIRSTNAME"; render them properly. */
function properName(raw) {
  if (!raw) return ''
  const [surname = '', first = ''] = raw.split(',').map((s) => s.trim())
  const cap = (s) =>
    s.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (_, p, c) => p + c.toUpperCase())
  return [cap(first), cap(surname)].filter(Boolean).join(' ')
}

/**
 * Everyone registered with any club this season, fetched once and shared.
 *
 * The per-club endpoint (`/clubs/<code>/people`) returns an empty list for
 * every club and season, and a `clubCode` query parameter is ignored — so
 * EuroLeague team pages showed no roster at all until this was found. The
 * season-level list is complete; it is filtered by club below. It pages at
 * 1,000 rows, so every page is read.
 */
async function seasonPeople(season) {
  const first = await get(`${FEED}/${season}/people?limit=1000`, 60 * 60_000)
  const rows = [...(first.data || [])]
  const pages = first.metadata?.totalPages || 1
  for (let page = 2; page <= pages; page++) {
    const more = await get(
      `${FEED}/${season}/people?limit=1000&offset=${(page - 1) * 1000}`,
      60 * 60_000
    ).catch(() => null)
    rows.push(...(more?.data || []))
  }
  return rows
}

export async function fetchRoster(league, teamCode) {
  const season = await currentSeasonCode()
  const [people, clubs] = await Promise.all([
    seasonPeople(season).catch(() => []),
    fetchTeams(league),
  ])
  const club = clubs.find((c) => c.id === teamCode)
  if (!club) return null

  const entries = people.filter((e) => e.club?.code === teamCode)
  const signed = entries.filter((e) => e.type === 'J')
  // `active` separates the current squad from players who have left. If a
  // club has none flagged yet (early off-season), show everyone registered.
  const current = signed.some((e) => e.active) ? signed.filter((e) => e.active) : signed
  const players = current
    .map((e) => {
      const p = e.person || {}
      const birth = p.birthDate ? new Date(p.birthDate) : null
      const age = birth ? Math.floor((Date.now() - birth.getTime()) / 31557600000) : null
      return {
        id: p.code,
        name: properName(p.name),
        jersey: e.dorsal || null,
        position: e.positionName || null,
        height: p.height ? `${(p.height / 100).toFixed(2)} m` : null,
        weight: p.weight ? `${p.weight} kg` : null,
        age,
        country: p.country?.name || p.birthCountry?.name || null,
        college: null,
        headshot: p.images?.headshot || p.images?.profile || null,
      }
    })
  players.sort((a, b) => Number(a.jersey ?? 999) - Number(b.jersey ?? 999))

  const coachEntry = entries.find((e) => e.type === 'C' || e.typeName === 'Head coach')

  return {
    team: club,
    coach: coachEntry ? properName(coachEntry.person?.name) : null,
    season: season.slice(1),
    players,
  }
}

export async function fetchGameSummary(league, gameId) {
  const season = await currentSeasonCode()
  const data = await get(`${FEED}/${season}/games?limit=500`, 60_000)
  const raw = (data.data || []).find((g) => String(g.code) === String(gameId))
  if (!raw) return null
  return { game: normaliseGame(raw, league.key), boxscore: [], recap: null, lastFive: null }
}

/** These feeds carry no wire copy — EuroLeague news still comes from ESPN. */
export async function fetchLeaders() {
  return null
}

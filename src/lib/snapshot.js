/**
 * Snapshot adapter for the leagues with no CORS-open public API
 * (PBA, KBL, B.League).
 *
 * `npm run data` writes real, scraped data to /public/data/<key>.json in the
 * same normalised shape ESPN gets massaged into, so the UI never has to know
 * which league came from where. If a snapshot is missing we return empty
 * collections rather than inventing anything — the UI then shows an honest
 * "no data yet, run npm run data" state.
 */

const cache = new Map()

export async function loadSnapshot(league) {
  if (cache.has(league.key)) return cache.get(league.key)

  const promise = fetch(`${import.meta.env.BASE_URL}data/${league.key}.json`)
    .then((res) => {
      if (!res.ok) throw new Error(`no snapshot for ${league.key}`)
      return res.json()
    })
    .catch(() => null)

  cache.set(league.key, promise)
  return promise
}

const EMPTY = {
  teams: [],
  games: [],
  news: [],
  standings: { seasonLabel: '', rows: [] },
  rosters: {},
}

export async function snapshotTeams(league) {
  const s = await loadSnapshot(league)
  return s?.teams ?? EMPTY.teams
}

export async function snapshotGames(league) {
  const s = await loadSnapshot(league)
  const games = s?.games ?? EMPTY.games
  return [...games].sort((a, b) => new Date(b.date) - new Date(a.date))
}

export async function snapshotStandings(league) {
  const s = await loadSnapshot(league)
  return s?.standings ?? EMPTY.standings
}

export async function snapshotNews(league) {
  const s = await loadSnapshot(league)
  return s?.news ?? EMPTY.news
}

export async function snapshotRoster(league, teamId) {
  const s = await loadSnapshot(league)
  if (!s) return null
  const team = (s.teams || []).find((t) => String(t.id) === String(teamId))
  const players = s.rosters?.[teamId] ?? []
  return team ? { team, coach: team.coach ?? null, season: s.season || '', players } : null
}

export async function snapshotGame(league, gameId) {
  const s = await loadSnapshot(league)
  const game = (s?.games || []).find((g) => String(g.id) === String(gameId))
  return game ? { game, boxscore: [], recap: null, lastFive: null } : null
}

/** Provenance for the "where this came from" footer on snapshot leagues. */
export async function snapshotMeta(league) {
  const s = await loadSnapshot(league)
  if (!s) return null
  return { fetchedAt: s.fetchedAt, season: s.season, sources: s.sources || [], notes: s.notes || [] }
}

/**
 * Supplements for live leagues (/public/data/extra/<key>.json).
 *
 * EuroLeague and the NBL are read live, but their live feeds lack news or
 * player averages. The scraper fills those gaps from sources a browser cannot
 * read directly; the app reaches for them only when the live source is empty.
 */
const extraCache = new Map()

export async function loadExtra(key) {
  if (extraCache.has(key)) return extraCache.get(key)
  const promise = fetch(`${import.meta.env.BASE_URL}data/extra/${key}.json`)
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null)
  extraCache.set(key, promise)
  return promise
}

/** Conference groups for snapshot leagues that play in conferences (PBA). */
export async function snapshotStandingsGrouped(league) {
  const s = await loadSnapshot(league)
  return {
    seasonLabel: s?.standings?.seasonLabel || '',
    conferences: s?.standings?.conferences || [],
    divisions: [],
  }
}

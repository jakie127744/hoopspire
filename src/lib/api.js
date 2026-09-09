/**
 * Unified data facade.
 *
 * Pages call these functions and never care whether a league is served live
 * from ESPN, from EuroLeague's own feeds, or from a scraped snapshot. Nothing
 * here fabricates data: if a source has nothing, the caller gets an empty list.
 */
import { LEAGUES, getLeague } from './leagues.js'
import * as espn from './espn.js'
import * as euro from './euroleague.js'
import * as snap from './snapshot.js'
import { getOriginals } from './articles.js'

/** Pick the adapter for a league. */
function adapterFor(league) {
  if (league.source === 'euroleague') return euro
  if (league.source === 'espn') return espn
  return null
}

export async function getGames(leagueKey) {
  const league = getLeague(leagueKey)
  if (!league) return []
  const a = adapterFor(league)
  try {
    return a ? await a.fetchRecentAndUpcoming(league) : await snap.snapshotGames(league)
  } catch {
    return []
  }
}

export async function getAllGames() {
  const lists = await Promise.all(LEAGUES.map((l) => getGames(l.key)))
  return lists.flat().sort((a, b) => new Date(b.date) - new Date(a.date))
}

export async function getStandings(leagueKey) {
  const league = getLeague(leagueKey)
  if (!league) return { seasonLabel: '', rows: [] }
  const a = adapterFor(league)
  try {
    return a ? await a.fetchStandings(league) : await snap.snapshotStandings(league)
  } catch {
    return { seasonLabel: '', rows: [] }
  }
}

/**
 * Standings split by conference and division.
 *
 * Only the ESPN adapter publishes groupings; everything else returns empty
 * arrays, and the UI then simply does not offer those tabs.
 */
export async function getStandingsGrouped(leagueKey) {
  const league = getLeague(leagueKey)
  const empty = { seasonLabel: '', conferences: [], divisions: [] }
  if (!league) return empty
  const a = adapterFor(league)
  if (!a?.fetchStandingsGrouped) return empty
  try {
    return await a.fetchStandingsGrouped(league)
  } catch {
    return empty
  }
}

/**
 * News.
 *
 * EuroLeague's own feeds carry no wire copy, so its stories come from ESPN's
 * EuroLeague page even though its scores and standings do not.
 */
export async function getNews(leagueKey, limit = 12) {
  const league = getLeague(leagueKey)
  if (!league) return []

  // Our own writing leads, then the wire fills in behind it.
  const originals = getOriginals(league.key)

  let wire = []
  try {
    wire = league.espnSlug
      ? await espn.fetchNews(league, limit)
      : await snap.snapshotNews(league)
  } catch {
    wire = []
  }

  return [...originals, ...wire].slice(0, limit)
}

export async function getAllNews(perLeague = 6) {
  const lists = await Promise.all(LEAGUES.map((l) => getNews(l.key, perLeague)))
  // Cross-league originals carry no league key, so they are added directly.
  lists.push(getOriginals(null).filter((a) => !a.league))

  // ESPN syndicates one story across several league feeds — a FIBA World Cup
  // report shows up under FIBA, WNBA and NBA alike. Keep the first copy
  // (leagues are ordered by prominence) so the front page isn't three
  // versions of the same headline.
  const seen = new Set()
  const unique = []
  for (const article of lists.flat()) {
    if (!article.title) continue
    const key = article.url || article.title.toLowerCase().replace(/\W+/g, '')
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(article)
  }

  // Newest first, but an original always outranks a wire item published the
  // same day — it is the reason someone would come here rather than to ESPN.
  return unique.sort((a, b) => {
    const day = (x) => String(x.published || '').slice(0, 10)
    if (day(a) === day(b) && !!a.original !== !!b.original) return a.original ? -1 : 1
    return new Date(b.published || 0) - new Date(a.published || 0)
  })
}

export async function getTeams(leagueKey) {
  const league = getLeague(leagueKey)
  if (!league) return []
  const a = adapterFor(league)
  try {
    return a ? await a.fetchTeams(league) : await snap.snapshotTeams(league)
  } catch {
    return []
  }
}

export async function getRoster(leagueKey, teamId) {
  const league = getLeague(leagueKey)
  if (!league) return null
  const a = adapterFor(league)
  try {
    return a ? await a.fetchRoster(league, teamId) : await snap.snapshotRoster(league, teamId)
  } catch {
    return null
  }
}

export async function getGame(leagueKey, gameId) {
  const league = getLeague(leagueKey)
  if (!league) return null
  const a = adapterFor(league)
  try {
    return a ? await a.fetchGameSummary(league, gameId) : await snap.snapshotGame(league, gameId)
  } catch {
    return null
  }
}

/**
 * Statistical leaders.
 *
 * Prefers the league's official season-leaders feed. When that isn't published
 * (off-season, or a league whose feed has no leaders endpoint), we derive them
 * from the per-game leaders actually recorded on recent box scores — still
 * real numbers, just a smaller sample, which the UI labels as such.
 */
export async function getLeaders(leagueKey) {
  const league = getLeague(leagueKey)
  if (!league) return { source: 'none', categories: {} }

  const a = adapterFor(league)
  if (a?.fetchLeaders) {
    const official = await a.fetchLeaders(league).catch(() => null)
    if (official) return { source: 'season', categories: official }
  } else {
    const s = await snap.loadSnapshot(league)
    if (s?.leaders && Object.keys(s.leaders).length) {
      return { source: 'season', categories: s.leaders }
    }
  }

  const games = await getGames(leagueKey)
  const buckets = {}
  for (const g of games) {
    for (const side of [g.home, g.away]) {
      for (const l of side?.leaders || []) {
        const key = (l.category || '').toLowerCase()
        const cat = key.includes('reb')
          ? 'avgRebounds'
          : key.includes('ast')
            ? 'avgAssists'
            : key.includes('pts') || key.includes('point')
              ? 'avgPoints'
              : null
        if (!cat) continue
        buckets[cat] ||= new Map()
        const prev = buckets[cat].get(l.name) || { total: 0, games: 0 }
        buckets[cat].set(l.name, {
          name: l.name,
          headshot: l.headshot,
          team: side.abbr,
          teamId: side.id,
          total: prev.total + (parseFloat(l.value) || 0),
          games: prev.games + 1,
        })
      }
    }
  }

  const categories = {}
  for (const [cat, map] of Object.entries(buckets)) {
    categories[cat] = [...map.values()]
      .map((p) => ({ ...p, value: (p.total / p.games).toFixed(1) }))
      .sort((a2, b2) => parseFloat(b2.value) - parseFloat(a2.value))
      .slice(0, 10)
  }

  return { source: Object.keys(categories).length ? 'recent' : 'none', categories }
}

export async function getSnapshotMeta(leagueKey) {
  const league = getLeague(leagueKey)
  if (!league || league.source !== 'snapshot') return null
  return snap.snapshotMeta(league)
}

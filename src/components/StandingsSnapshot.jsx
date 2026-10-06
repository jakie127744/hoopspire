import { Link } from 'react-router-dom'
import { useAsync } from '../lib/useAsync.js'
import { getStandings } from '../lib/api.js'
import { LEAGUES } from '../lib/leagues.js'
import StandingsTable from './StandingsTable.jsx'
import { SectionHead } from './Primitives.jsx'

const FEATURED = 2
const RECENT_DAYS = 14
const PICKED_DAYS = 90

/** Weeks since the epoch, turning over on Monday (1 Jan 1970 was a Thursday). */
const weekNumber = (now = Date.now()) => Math.floor((now / 86_400_000 + 3) / 7)

/**
 * Leagues worth a standings table this week.
 *
 * In season means a result in the last fortnight. Without that test the
 * rotation would land on a league between seasons and print last season's
 * final table on the front page as if it were this week's — the CBA's
 * snapshot, for one, still carries 2025-26 until its new season tips.
 */
export function inSeasonLeagues(games, days = RECENT_DAYS, now = Date.now()) {
  const cutoff = now - days * 86_400_000
  const recent = new Set(
    games
      .filter((g) => g.status === 'final' && new Date(g.date).getTime() >= cutoff)
      .map((g) => g.league)
  )
  return LEAGUES.filter((l) => recent.has(l.key))
}

const played = (rows) => rows.some((r) => (r.wins ?? 0) + (r.losses ?? 0) > 0)

/**
 * Top five of two leagues, rotating weekly through the ones in season, so
 * over a month the front page shows most of the ledger instead of the same
 * two tables every visit. With a league picked in the switcher, that
 * league's table instead.
 *
 * Tables are fetched in rotation order and stop at the first two that pass:
 * rows exist, games have been played, and it is not ESPN's fallback to the
 * previous season. If none pass, the section does not render.
 */
export default function StandingsSnapshot({ games, league }) {
  let candidates
  if (league) {
    // A league the reader picked gets more slack than the rotation: the PBA
    // breaks for weeks mid-season and its table is still this season's. But
    // a league with no result in three months is between seasons, and its
    // table is last year's.
    candidates = inSeasonLeagues(games, PICKED_DAYS).filter((l) => l.key === league.key)
  } else {
    const pool = inSeasonLeagues(games)
    const start = pool.length ? weekNumber() % pool.length : 0
    candidates = [...pool.slice(start), ...pool.slice(0, start)]
  }
  const want = league ? 1 : FEATURED
  const keys = candidates.map((l) => l.key).join(',')

  const { data: tables } = useAsync(
    async () => {
      const found = []
      for (const l of candidates) {
        const s = await getStandings(l.key)
        const rows = s?.rows || []
        if (rows.length && played(rows) && !s.isPreviousSeason) found.push({ league: l, standings: s })
        if (found.length === want) break
      }
      return found
    },
    [keys],
    []
  )

  if (!tables?.length) return null

  return (
    <section className="mx-auto max-w-7xl px-4 pt-20 md:px-8">
      <SectionHead
        title="Standings"
        action={
          <Link to={`/league/${tables[0].league.slug}`} className="eyebrow text-crimson hover:underline">
            {league ? `All ${league.name} standings →` : 'Full tables on each league page →'}
          </Link>
        }
      />
      <div className={`grid gap-8 ${tables.length > 1 ? 'lg:grid-cols-2' : ''}`}>
        {tables.map(({ league: l, standings }) => (
          <div key={l.key} className="card p-5">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <Link to={`/league/${l.slug}`} className="font-display text-2xl hover:text-crimson">
                {l.name}
              </Link>
              {standings.seasonLabel && (
                <span className="eyebrow text-ink/45">{standings.seasonLabel}</span>
              )}
            </div>
            <StandingsTable standings={standings} leagueKey={l.key} limit={5} compact />
          </div>
        ))}
      </div>
    </section>
  )
}

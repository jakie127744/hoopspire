import { NavLink, useParams, Link } from 'react-router-dom'
import { getLeague, LEAGUES } from '../lib/leagues.js'
import { useAsync } from '../lib/useAsync.js'
import { getNews, getGames, getStandings } from '../lib/api.js'
import ArticleCard from '../components/ArticleCard.jsx'
import ScoreCard from '../components/ScoreCard.jsx'
import StandingsPanel from '../components/StandingsPanel.jsx'
import { SectionHead, Loading, Empty, Eyebrow } from '../components/Primitives.jsx'
import { formatDate } from '../lib/format.js'

export function LeagueRail({ current }) {
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-parchment pb-4">
      {LEAGUES.map((l) => (
        <NavLink
          key={l.key}
          to={`/league/${l.slug}`}
          className={`shrink-0 border px-4 py-2 transition-colors ${
            current === l.key
              ? 'border-ink bg-ink text-cream'
              : 'border-parchment hover:border-ink'
          }`}
        >
          <Eyebrow>{l.name}</Eyebrow>
        </NavLink>
      ))}
    </div>
  )
}

export default function League() {
  const { key } = useParams()
  const league = getLeague(key)

  const { data: news, loading: newsLoading } = useAsync(
    () => (league ? getNews(league.key, 9) : []),
    [key],
    []
  )
  const { data: games } = useAsync(() => (league ? getGames(league.key) : []), [key], [])
  const { data: standings } = useAsync(
    () => (league ? getStandings(league.key) : null),
    [key],
    null
  )

  if (!league) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-24 md:px-8">
        <h1 className="text-4xl">Unknown league.</h1>
        <Link to="/" className="eyebrow mt-4 inline-block text-crimson">
          ← Back to the ledger
        </Link>
      </div>
    )
  }

  const stories = news || []
  const lead = stories[0]
  const rest = stories.slice(1)
  const finals = (games || []).filter((g) => g.status !== 'scheduled').slice(0, 4)
  const upcoming = (games || [])
    .filter((g) => g.status === 'scheduled')
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5)

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 md:px-8">
      <Eyebrow className="text-crimson">{league.region}</Eyebrow>
      <h1 className="mt-3 text-6xl md:text-7xl">{league.name}</h1>
      <p className="mt-2 text-lg text-ink/60">{league.fullName}</p>

      <div className="mt-8">
        <LeagueRail current={league.key} />
      </div>

      <div className="mt-14 grid gap-12 lg:grid-cols-[1.6fr_1fr]">
        <div>
          {newsLoading ? (
            <Loading label={`Pulling ${league.name} wire`} />
          ) : lead ? (
            <>
              <ArticleCard article={lead} variant="lead" />
              {rest.length > 0 && (
                <div className="mt-12">
                  <SectionHead title={`More from ${league.name}`} />
                  <div className="grid gap-6 sm:grid-cols-2">
                    {rest.map((a) => (
                      <ArticleCard key={a.id} article={a} />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <Empty
              title={`No ${league.name} stories on the wire.`}
              hint={
                league.source === 'snapshot'
                  ? 'Run `npm run data` to refresh this league.'
                  : undefined
              }
            />
          )}
        </div>

        <aside className="space-y-12">
          <div>
            <Eyebrow className="text-ink/45">Recent Results</Eyebrow>
            <div className="mt-3 space-y-4">
              {finals.length ? (
                finals.map((g) => <ScoreCard key={g.id} game={g} />)
              ) : (
                <Empty title="No results yet." />
              )}
            </div>
          </div>

          {upcoming.length > 0 && (
            <div>
              <Eyebrow className="text-ink/45">Upcoming</Eyebrow>
              <ul className="mt-3 divide-y divide-parchment border-t border-parchment">
                {upcoming.map((g) => (
                  <li key={g.id} className="py-3">
                    <Link to={`/game/${g.league}/${g.id}`} className="block hover:text-crimson">
                      <p className="eyebrow">
                        {g.away?.abbr || g.away?.name} @ {g.home?.abbr || g.home?.name}
                      </p>
                      <p className="mt-1 text-xs text-ink/45">
                        {formatDate(g.date)} · {g.venue || g.city || 'Venue TBD'}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

      <section className="mt-20">
        <SectionHead
          title={`${league.name} Standings`}
          action={
            <Link to="/stats" className="eyebrow text-crimson hover:underline">
              Full Stats →
            </Link>
          }
        >
          {standings?.seasonLabel && (
            <span className="eyebrow text-ink/40">{standings.seasonLabel}</span>
          )}
        </SectionHead>
        <StandingsPanel league={league} />
      </section>
    </div>
  )
}

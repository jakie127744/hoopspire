import { useParams, Link } from 'react-router-dom'
import { getLeague } from '../lib/leagues.js'
import { useAsync } from '../lib/useAsync.js'
import { getGames, getStandings } from '../lib/api.js'
import { getOriginals } from '../lib/articles.js'
import { HeroStory, FeedCard, RailCard } from '../components/NewsBlocks.jsx'
import StandingsPanel from '../components/StandingsPanel.jsx'
import { LeaderboardAd, RailAd, withFeedAds } from '../components/Ads.jsx'
import { SectionHead, TeamLogo } from '../components/Primitives.jsx'
import { formatDate } from '../lib/format.js'
import { useMeta } from '../lib/meta.js'

export default function League() {
  const { key } = useParams()
  const league = getLeague(key)

  useMeta({
    title: league ? `${league.name}` : 'League',
    description: league
      ? `${league.name} scores, standings, rosters and stats on Hoopspire — results as they finish and the table as it stands.`
      : undefined,
  })

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

  // Originals only, read straight from the bundle, so the prerendered page
  // has the league's stories in it rather than a loading state.
  const stories = getOriginals(league.key, 15)
  const [lead, ...rest] = stories
  const finals = (games || [])
    .filter((g) => g.status !== 'scheduled')
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6)
  const upcoming = (games || [])
    .filter((g) => g.status === 'scheduled' && new Date(g.date).getTime() > Date.now() - 3 * 3600_000)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 6)

  return (
    <>
    {lead && <LeaderboardAd />}
    <div className="bleed mx-auto max-w-[1440px] py-3 sm:px-4 sm:py-4 md:py-5">
      <h1 className="sr-only">
        {league.name} — {league.fullName}
      </h1>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] xl:gap-5">
        <div className="min-w-0 space-y-4">
          {lead ? (
            <>
              <HeroStory article={lead} more={rest.slice(0, 3)} />
              {withFeedAds(rest.slice(3), (a) => (
                <FeedCard key={a.id} article={a} />
              ))}
            </>
          ) : (
            <div className="card p-6">
              <p className="text-lg font-bold">Nothing written on the {league.name} yet.</p>
              <p className="mt-1 text-sm text-ink/60">
                Scores, standings and rosters are below and in the menu above.
              </p>
            </div>
          )}
        </div>

        <aside className="min-w-0 space-y-4">
          <RailCard
            title="Recent Results"
            action={
              <Link to={`/scores?league=${league.key}`} className="text-xs font-bold text-crimson hover:underline">
                Scoreboard
              </Link>
            }
          >
            {finals.length ? (
              <ul>
                {finals.map((g) => (
                  <GameRow key={g.id} game={g} />
                ))}
              </ul>
            ) : (
              <p className="px-4 py-4 text-sm text-ink/55">No results yet.</p>
            )}
          </RailCard>

          {lead && <RailAd />}

          {upcoming.length > 0 && (
            <RailCard title="Upcoming">
              <ul>
                {upcoming.map((g) => (
                  <GameRow key={g.id} game={g} />
                ))}
              </ul>
            </RailCard>
          )}

          <div className="card flex items-center gap-3 p-4">
            {league.logo && <img src={league.logo} alt="" className="h-10 w-10 object-contain" />}
            <div className="min-w-0">
              <p className="text-sm font-extrabold">{league.fullName}</p>
              <p className="text-xs text-ink/55">{league.region}</p>
            </div>
          </div>
        </aside>
      </div>

      <section id="standings" className="card mt-5 scroll-mt-20 p-4 md:p-5">
        <SectionHead
          title={`${league.name} Standings`}
          action={
            <Link to={`/stats?league=${league.key}`} className="text-xs font-bold text-crimson hover:underline">
              Full Stats
            </Link>
          }
        >
          {standings?.seasonLabel && <span className="text-xs font-semibold text-ink/45">{standings.seasonLabel}</span>}
        </SectionHead>
        <StandingsPanel league={league} />
      </section>
    </div>
    </>
  )
}

/** One game as a rail row: both teams, the score or the tip time. */
function GameRow({ game: g }) {
  const played = g.status !== 'scheduled'
  const h = Number(g.home?.score ?? 0)
  const a = Number(g.away?.score ?? 0)
  const team = (t, score, won) => (
    <span className={`flex items-center gap-2 ${played && !won ? 'text-ink/50' : ''}`}>
      <TeamLogo team={t} size={18} />
      <span className="flex-1 truncate text-sm font-bold">{t?.shortName || t?.name || 'TBD'}</span>
      {played && <span className="tabular text-sm font-extrabold">{score ?? '–'}</span>}
    </span>
  )
  return (
    <li className="border-b border-parchment last:border-0">
      <Link to={`/game/${g.league}/${g.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-cream">
        <span className="min-w-0 flex-1 space-y-1">
          {team(g.away, g.away?.score, a > h)}
          {team(g.home, g.home?.score, h > a)}
        </span>
        <span className="w-16 shrink-0 border-l border-parchment pl-3 text-right text-[0.6875rem] font-bold uppercase text-ink/55">
          {g.status === 'final' ? 'Final' : g.status === 'live' ? <span className="text-crimson">Live</span> : formatDate(g.date)}
        </span>
      </Link>
    </li>
  )
}

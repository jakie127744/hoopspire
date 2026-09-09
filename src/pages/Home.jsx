import { Link } from 'react-router-dom'
import { useAsync, hasLiveGame } from '../lib/useAsync.js'
import { getAllNews, getAllGames } from '../lib/api.js'
import { CORE_LEAGUES } from '../lib/leagues.js'
import ArticleCard from '../components/ArticleCard.jsx'
import ScoreCard from '../components/ScoreCard.jsx'
import { SectionHead, Loading, Empty, Eyebrow } from '../components/Primitives.jsx'

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1600&q=80'

/** Hero: photo panel on the left, the five-league ledger rail on the right. */
function Hero({ leadByLeague }) {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-8 md:px-8">
      <div className="grid gap-0 lg:grid-cols-[1.15fr_1fr]">
        <div className="relative min-h-[420px] overflow-hidden bg-ink">
          <img
            src={HERO_IMAGE}
            alt="A basketball dropping through the net under arena lights"
            className="absolute inset-0 h-full w-full object-cover opacity-70"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/50 to-transparent" />
          <div className="relative flex h-full flex-col justify-end p-8 text-cream md:p-10">
            <Eyebrow className="text-gold">The Global Arena</Eyebrow>
            <h1 className="mt-4 font-display text-5xl leading-[0.95] md:text-7xl">
              Heritage of the
              <br />
              <em className="italic">Hardwood</em>
            </h1>
            <p className="mt-5 max-w-md text-cream/75">
              Five leagues, one ledger — every score, standing and roster pulled live from the
              competitions themselves.
            </p>
          </div>
        </div>

        <div className="border border-parchment bg-paper p-8 md:p-10">
          <h2 className="font-display text-3xl">Five Leagues. One Ledger.</h2>
          <div className="mt-6 divide-y divide-parchment">
            {CORE_LEAGUES.map((l) => {
              const lead = leadByLeague?.[l.key]
              return (
                <Link
                  key={l.key}
                  to={`/league/${l.slug}`}
                  className="group flex flex-col gap-1 py-4 first:pt-0"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-display text-2xl group-hover:text-crimson">
                      {l.name}
                    </span>
                    <Eyebrow className="shrink-0 text-ink/35">{l.region}</Eyebrow>
                  </div>
                  <p className="line-clamp-1 text-sm text-ink/60">
                    {lead?.title || l.fullName}
                  </p>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

export default function Home() {
  const { data: news, loading } = useAsync(() => getAllNews(6), [], [])
  const { data: games } = useAsync(() => getAllGames(), [], [], {
    refreshMs: 120_000,
    liveMs: 30_000,
    isLive: hasLiveGame,
  })

  const stories = news || []
  const lead = stories[0]
  const alsoToday = stories.slice(1, 6)
  const grid = stories.slice(1, 10)

  // One representative headline per league for the hero rail.
  const leadByLeague = {}
  for (const a of stories) {
    if (!leadByLeague[a.league]) leadByLeague[a.league] = a
  }

  const finals = (games || []).filter((g) => g.status === 'final').slice(0, 8)
  const live = (games || []).filter((g) => g.status === 'live')

  return (
    <>
      <Hero leadByLeague={leadByLeague} />

      <section className="mx-auto max-w-7xl px-4 pt-20 md:px-8">
        <SectionHead title="The Lead" />
        {loading ? (
          <Loading label="Pulling the wire" />
        ) : !lead ? (
          <Empty
            title="The wire is quiet."
            hint="Live stories load from ESPN; check your connection and reload."
          />
        ) : (
          <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
            <ArticleCard article={lead} variant="lead" />
            <div>
              <Eyebrow className="text-ink/45">Also Today</Eyebrow>
              <div className="mt-3">
                {alsoToday.map((a) => (
                  <ArticleCard key={a.id} article={a} variant="compact" />
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-20 md:px-8">
        <SectionHead title="From the Hardwood" />
        {grid.length ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {grid.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        ) : (
          !loading && <Empty title="No stories on the wire right now." />
        )}
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-20 md:px-8">
        <SectionHead
          title="Final Whistles"
          action={
            <Link to="/scores" className="eyebrow text-crimson hover:underline">
              All Scores →
            </Link>
          }
        />
        {live.length > 0 && (
          <div className="mb-6">
            <Eyebrow className="text-crimson">Live Now · {live.length}</Eyebrow>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {live.map((g) => (
                <ScoreCard key={g.id} game={g} />
              ))}
            </div>
          </div>
        )}
        {finals.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {finals.map((g) => (
              <ScoreCard key={`${g.league}-${g.id}`} game={g} />
            ))}
          </div>
        ) : (
          <Empty title="No completed games in the current window." />
        )}
      </section>
    </>
  )
}

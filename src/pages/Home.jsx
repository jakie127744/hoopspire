import { Link } from 'react-router-dom'
import { useAsync, hasLiveGame } from '../lib/useAsync.js'
import { getAllGames } from '../lib/api.js'
import { getOriginals } from '../lib/articles.js'
import { leaguesByGroup, LEAGUE_COUNT_WORD } from '../lib/leagues.js'
import ArticleCard from '../components/ArticleCard.jsx'
import ScoreCard from '../components/ScoreCard.jsx'
import { SectionHead, Empty, Eyebrow } from '../components/Primitives.jsx'
import { useMeta } from '../lib/meta.js'

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1600&q=80'

/**
 * Hero: the photo panel on the left, and every league in the ledger on the
 * right, grouped by region.
 *
 * The count in both headlines comes from LEAGUE_COUNT_WORD — it was typed as
 * "Five" once and went stale as soon as the list grew, so it is no longer
 * typed at all.
 */
function Hero({ leadByLeague }) {
  const count = LEAGUE_COUNT_WORD
  return (
    <section className="mx-auto max-w-7xl px-4 pt-8 md:px-8">
      <div className="grid gap-0 lg:grid-cols-[1fr_1.1fr]">
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
              {count} leagues, from Manila to Madrid to São Paulo — one ledger, with every score,
              standing and roster taken from the competitions and the desks that cover them.
            </p>
          </div>
        </div>

        <div className="border border-parchment bg-paper p-6 md:p-8">
          <h2 className="font-display text-3xl">{count} Leagues. One Ledger.</h2>

          <div className="mt-5 space-y-5">
            {leaguesByGroup().map(({ group, leagues }) => (
              <div key={group}>
                <Eyebrow className="text-gold">{group}</Eyebrow>
                <div className="mt-1 divide-y divide-parchment">
                  {leagues.map((l) => {
                    // Our own piece on this league where we have one, and the
                    // league's own description where we do not. The wire used
                    // to fill this rail, which put thirteen other publishers'
                    // headlines on the first screen of our front page.
                    const lead = leadByLeague?.[l.key]
                    return (
                      <Link
                        key={l.key}
                        to={`/league/${l.slug}`}
                        className="group flex items-baseline gap-3 py-2"
                      >
                        <span className="w-24 shrink-0 font-display text-xl leading-tight group-hover:text-crimson">
                          {l.name}
                        </span>
                        <span className="line-clamp-1 flex-1 text-xs text-ink/55">
                          {lead?.title || l.fullName}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default function Home() {
  useMeta({ description: 'Live scores, standings, rosters and original analysis across thirteen basketball leagues — the NBA, WNBA, EuroLeague, PBA, KBL, B.League, CBA and more.' })
  const { data: games } = useAsync(() => getAllGames(), [], [], {
    refreshMs: 120_000,
    liveMs: 30_000,
    isLive: hasLiveGame,
  })

  // Our own writing leads the page. It is bundled at build time, so there is
  // no loading state to design around and nothing that can fail to arrive.
  // Nothing on this page comes from other outlets any more — that content
  // moved to its own page, /wire, with no ad anywhere near it. See Wire.jsx.
  const originals = getOriginals(null, 7)
  const ourLead = originals[0]
  const ourAlso = originals.slice(1, 4)
  const ourMore = originals.slice(4, 7)

  // One line per league in the hero rail, preferring a piece we wrote.
  const leadByLeague = {}
  for (const a of originals) {
    if (a.league && !leadByLeague[a.league]) leadByLeague[a.league] = a
  }

  const finals = (games || []).filter((g) => g.status === 'final').slice(0, 8)
  const live = (games || []).filter((g) => g.status === 'live')

  return (
    <>
      <Hero leadByLeague={leadByLeague} />

      {/*
        The front page leads with what we wrote. It used to open on the wire,
        which meant the first thing anyone saw on hoopspire.com — a reader, or
        someone deciding whether this is a publication — was a column of other
        outlets' headlines with their bylines on them. Our own work was a
        click away at /margin and invisible from here.
      */}
      {ourLead && (
        <section className="mx-auto max-w-7xl px-4 pt-20 md:px-8">
          <SectionHead
            title="Latest"
            action={
              <Link to="/margin" className="eyebrow text-crimson hover:underline">
                The Margin →
              </Link>
            }
          />
          <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
            <ArticleCard article={ourLead} variant="lead" />
            <div>
              <Eyebrow className="text-ink/45">More from our desks</Eyebrow>
              <div className="mt-3">
                {ourAlso.map((a) => (
                  <ArticleCard key={a.id} article={a} variant="compact" />
                ))}
              </div>
            </div>
          </div>
          {ourMore.length > 0 && (
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {ourMore.map((a) => (
                <ArticleCard key={a.id} article={a} />
              ))}
            </div>
          )}
        </section>
      )}

      {/*
        Our own ledger data — live scores and recent results — comes next,
        directly after our own writing. It is the site's own database, not
        linked-out content, so it belongs at the front of the page.
      */}
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

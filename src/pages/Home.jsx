import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useAsync, hasLiveGame } from '../lib/useAsync.js'
import { getAllGames } from '../lib/api.js'
import { getOriginals, getDesk } from '../lib/articles.js'
import { LEAGUE_COUNT_WORD, getLeague } from '../lib/leagues.js'
import { SITE } from '../lib/site.js'
import { StandingsCard } from '../components/StandingsSnapshot.jsx'
import { HeroStory, FeedCard, HeadlineList, DeskCard, QuickLinks } from '../components/NewsBlocks.jsx'
import NewsletterSignup from '../components/NewsletterSignup.jsx'
import { LeaderboardAd, RailAd, MultiplexAd, withFeedAds } from '../components/Ads.jsx'
import { useMeta } from '../lib/meta.js'

/** Stories in the centre feed under the hero. */
const FEED_SIZE = 12

/**
 * The front page, laid out like ESPN's: quick links down the left on wide
 * screens, the lead story and the feed in the middle, and a right rail of
 * Top Headlines, standings and each desk's latest. The scoreboard sits above
 * it all, in the bar under the masthead.
 *
 * Everything here is our own writing, bundled at build time, so there is no
 * loading state to design around.
 */
export default function Home() {
  useMeta({
    description: `Live scores, standings, rosters and original analysis across ${LEAGUE_COUNT_WORD.toLowerCase()} basketball leagues — the NBA, WNBA, EuroLeague, PBA, KBL, B.League, CBA and more.`,
  })
  const { data: games } = useAsync(() => getAllGames(), [], [], {
    refreshMs: 120_000,
    liveMs: 30_000,
    isLive: hasLiveGame,
  })

  // The front page used to filter itself with ?league=. Each league has its
  // own front page now, so an old bookmark goes there.
  const [params] = useSearchParams()
  const old = getLeague(params.get('league'))
  if (old) return <Navigate to={`/league/${old.slug}`} replace />

  const originals = getOriginals()
  const [lead, ...rest] = originals
  const heroMore = rest.slice(0, 3)
  const feed = rest.slice(3, 3 + FEED_SIZE)
  const headlines = rest.slice(0, 10)

  const deskCards = (
    <>
      <DeskCard desk="fantasy" articles={getDesk('fantasy', null, 3)} />
      <DeskCard desk="scouting" articles={getDesk('scouting', null, 3)} />
      <DeskCard desk="opinion" articles={getDesk('opinion', null, 3)} />
    </>
  )

  return (
    <>
    <LeaderboardAd />
    <div className="bleed mx-auto max-w-[1440px] py-3 sm:px-4 sm:py-4 md:py-5">
      {/* The name stays the page's h1 for readers using headings to get around. */}
      <h1 className="sr-only">
        Hoopspire — {SITE.tagline}
      </h1>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem] xl:grid-cols-[13rem_minmax(0,1fr)_20rem] xl:gap-5">
        <aside className="hidden xl:block">
          <div className="sticky top-[4.5rem]">
            <QuickLinks />
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          {lead ? (
            <HeroStory article={lead} more={heroMore} />
          ) : (
            <p className="card p-6 text-ink/60">Nothing published yet.</p>
          )}

          {/* On a phone the rail's headline list comes straight after the lead. */}
          <HeadlineList articles={headlines} className="lg:hidden" />

          {withFeedAds(feed, (a) => (
            <FeedCard key={a.id} article={a} />
          ))}

          <MultiplexAd />

          <div className="flex justify-center pt-2">
            <Link
              to="/archive"
              className="rounded-full border border-ink/25 bg-paper px-6 py-2.5 text-sm font-bold hover:border-ink"
            >
              More stories in the archive
            </Link>
          </div>
        </div>

        <aside className="min-w-0 space-y-4">
          <HeadlineList articles={headlines} className="hidden lg:block" />
          <RailAd />
          <StandingsCard games={games || []} />
          {deskCards}
          <div className="card p-4">
            <NewsletterSignup variant="compact" />
          </div>
          <RailAd tall />
        </aside>
      </div>
    </div>
    </>
  )
}

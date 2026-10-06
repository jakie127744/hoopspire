import { Link, useSearchParams } from 'react-router-dom'
import { useAsync, hasLiveGame } from '../lib/useAsync.js'
import { getAllGames } from '../lib/api.js'
import { getOriginals } from '../lib/articles.js'
import { LEAGUES, LEAGUE_COUNT_WORD, getLeague } from '../lib/leagues.js'
import { SITE } from '../lib/site.js'
import ArticleCard from '../components/ArticleCard.jsx'
import ScoreCard from '../components/ScoreCard.jsx'
import { SectionHead, Eyebrow } from '../components/Primitives.jsx'
import { useMeta } from '../lib/meta.js'

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1600&q=60'

/** How many pieces the front-page grid shows: three full rows on desktop. */
const GRID_SIZE = 9

/**
 * Masthead banner.
 *
 * This used to be a full-height photo panel beside a fourteen-row league
 * rail, which put the whole first screen of the site between a returning
 * reader and anything new. It says the same thing on every visit, so it now
 * takes a strip: the name, the tagline under it, one line of what this is.
 *
 * Hoopspire is the h1. "Heritage of the Hardwood" was the h1 and the name sat
 * only in the header, so a first-time visitor had two names to choose
 * between. The tagline stays, as a tagline.
 */
function Masthead() {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-6 md:px-8">
      <div className="relative overflow-hidden bg-ink">
        <img
          src={HERO_IMAGE}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/40" />
        <div className="relative px-6 py-8 text-cream md:px-10 md:py-10">
          <h1 className="font-display text-5xl leading-none md:text-6xl">
            Hoop<span className="text-gold">spire</span>
          </h1>
          <p className="mt-2 font-display text-xl italic text-gold md:text-2xl">{SITE.tagline}</p>
          <p className="mt-3 max-w-2xl text-base text-cream/75">
            {LEAGUE_COUNT_WORD} leagues, from Manila to Madrid to São Paulo. Every score, standing
            and story in one ledger.
          </p>
        </div>
      </div>
    </section>
  )
}

/**
 * League filter for the story grid.
 *
 * Only leagues we have actually written about get a chip. A chip for every
 * league in the ledger would mean most of them filter the grid down to
 * nothing, and an empty grid on the front page reads as a broken site. The
 * choice lives in the URL (?league=PBA) so a filtered front page can be
 * bookmarked and shared.
 */
function LeagueFilter({ leagues, active, onPick }) {
  const chip = (selected) =>
    `eyebrow inline-flex min-h-11 shrink-0 items-center border px-4 transition-colors ${
      selected
        ? 'border-ink bg-ink text-cream'
        : 'border-parchment bg-paper text-ink/70 hover:border-ink hover:text-ink'
    }`
  return (
    <div
      role="group"
      aria-label="Filter stories by league"
      className="-mx-4 mb-8 flex snap-x gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0"
    >
      <button type="button" className={`${chip(!active)} snap-start`} aria-pressed={!active} onClick={() => onPick(null)}>
        All
      </button>
      {leagues.map((l) => (
        <button
          key={l.key}
          type="button"
          className={`${chip(active === l.key)} snap-start`}
          aria-pressed={active === l.key}
          onClick={() => onPick(l.key)}
        >
          {l.name}
        </button>
      ))}
    </div>
  )
}

export default function Home() {
  useMeta({
    description: `Live scores, standings, rosters and original analysis across ${LEAGUE_COUNT_WORD.toLowerCase()} basketball leagues — the NBA, WNBA, EuroLeague, PBA, KBL, B.League, CBA and more.`,
  })
  const { data: games } = useAsync(() => getAllGames(), [], [], {
    refreshMs: 120_000,
    liveMs: 30_000,
    isLive: hasLiveGame,
  })

  // Our own writing leads the page. It is bundled at build time, so there is
  // no loading state to design around and nothing that can fail to arrive.
  // Nothing on this page comes from other outlets any more — that content
  // moved to its own page, /wire, with no ad anywhere near it. See Wire.jsx.
  const originals = getOriginals()

  // Chips in ledger order, for the leagues that have at least one piece.
  const covered = new Set(originals.map((a) => a.league).filter(Boolean))
  const filterLeagues = LEAGUES.filter((l) => covered.has(l.key))

  const [params, setParams] = useSearchParams()
  // An unknown or uncovered ?league= falls back to All rather than an empty grid.
  const picked = getLeague(params.get('league'))
  const active = picked && covered.has(picked.key) ? picked.key : null
  const pick = (key) => {
    const next = new URLSearchParams(params)
    if (key) next.set('league', key)
    else next.delete('league')
    setParams(next, { replace: true, preventScrollReset: true })
  }

  const stories = (active ? originals.filter((a) => a.league === active) : originals).slice(
    0,
    GRID_SIZE
  )
  const activeLeague = active ? getLeague(active) : null

  const finals = (games || []).filter((g) => g.status === 'final').slice(0, 8)
  const live = (games || []).filter((g) => g.status === 'live')

  return (
    <>
      <Masthead />

      {/*
        The front page leads with what we wrote. It used to open on the wire,
        which meant the first thing anyone saw on hoopspire.com — a reader, or
        someone deciding whether this is a publication — was a column of other
        outlets' headlines with their bylines on them. Our own work was a
        click away at /margin and invisible from here.
      */}
      {originals.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-12 md:px-8">
          <SectionHead
            title="Latest"
            action={
              activeLeague ? (
                <Link
                  to={`/league/${activeLeague.slug}`}
                  className="eyebrow text-crimson hover:underline"
                >
                  All {activeLeague.name} →
                </Link>
              ) : (
                <Link to="/margin" className="eyebrow text-crimson hover:underline">
                  The Margin →
                </Link>
              )
            }
          />
          {filterLeagues.length > 1 && (
            <LeagueFilter leagues={filterLeagues} active={active} onPick={pick} />
          )}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {stories.map((a) => (
              <ArticleCard key={a.id} article={a} variant="tile" />
            ))}
          </div>
        </section>
      )}

      {/*
        Our own ledger data — live scores and recent results — comes next,
        directly after our own writing. It is the site's own database, not
        linked-out content, so it belongs at the front of the page.

        The section only renders when it has a game to show. It used to stand
        empty between windows with "No completed games in the current window",
        which on the front page reads as a site that is broken, not idle.
      */}
      {(live.length > 0 || finals.length > 0) && (
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
          {finals.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {finals.map((g) => (
                <ScoreCard key={`${g.league}-${g.id}`} game={g} />
              ))}
            </div>
          )}
        </section>
      )}
    </>
  )
}

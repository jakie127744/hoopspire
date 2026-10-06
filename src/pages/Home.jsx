import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAsync, hasLiveGame } from '../lib/useAsync.js'
import { getAllGames } from '../lib/api.js'
import { getOriginals } from '../lib/articles.js'
import { LEAGUES, LEAGUE_COUNT_WORD, getLeague } from '../lib/leagues.js'
import { SITE } from '../lib/site.js'
import ArticleCard from '../components/ArticleCard.jsx'
import ScoreStrip from '../components/ScoreStrip.jsx'
import { GamesGrid, pickSlate, SHOW as GAMES_SHOWN } from '../components/TodaysGames.jsx'
import { useStandingsTables, StandingsGrid } from '../components/StandingsSnapshot.jsx'
import { SectionHead, Wordmark } from '../components/Primitives.jsx'
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
          <h1>
            <Wordmark onDark className="text-[2.6rem] sm:text-5xl md:text-6xl" />
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
 * League switcher, shared by the scoreboard and the story grid.
 *
 * One choice drives the whole front page: pick PBA and the scoreboard, the
 * day's games, the stories and the standings all narrow to the PBA. It
 * lives in the URL (?league=PBA) so a reader who only follows one league can
 * bookmark their own front page.
 *
 * Only leagues with something to show get a chip: a story, or a game in the
 * current window. A chip for every league in the ledger would mean most of
 * them narrow the page down to nothing.
 */
function LeagueSwitcher({ leagues, active, onPick, label, className = '' }) {
  const chip = (selected) =>
    `eyebrow inline-flex min-h-11 shrink-0 snap-start items-center border px-4 transition-colors ${
      selected
        ? 'border-ink bg-ink text-cream'
        : 'border-parchment bg-paper text-ink/70 hover:border-ink hover:text-ink'
    }`
  return (
    <div
      role="group"
      aria-label={label}
      className={`no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0 ${className}`}
    >
      <button type="button" className={chip(!active)} aria-pressed={!active} onClick={() => onPick(null)}>
        All
      </button>
      {leagues.map((l) => (
        <button
          key={l.key}
          type="button"
          className={chip(active === l.key)}
          aria-pressed={active === l.key}
          onClick={() => onPick(l.key)}
        >
          {l.name}
        </button>
      ))}
    </div>
  )
}

/**
 * The day's games and the standings, as two tabs of one panel at the foot of
 * the page.
 *
 * Both answer "where do things stand", and stacked one above the other they
 * pushed the stories a long way down. A tab only appears when it has
 * something in it; with one, it is a plain section with no tabs at all.
 */
function GamesAndStandings({ games, allGames, league }) {
  const slate = pickSlate(games)
  const tables = useStandingsTables(allGames, league)
  const tabs = [
    slate && { key: 'games', label: slate.title },
    tables.length > 0 && { key: 'standings', label: 'Standings' },
  ].filter(Boolean)
  const [picked, setPicked] = useState(null)
  if (!tabs.length) return null
  const active = tabs.some((t) => t.key === picked) ? picked : tabs[0].key

  const more = slate ? slate.items.length - GAMES_SHOWN : 0
  const action =
    active === 'games' ? (
      <Link to="/scores" className="eyebrow text-crimson hover:underline">
        {more > 0 ? `${more} more →` : 'Full schedule →'}
      </Link>
    ) : (
      <Link to={`/league/${(league || tables[0].league).slug}`} className="eyebrow text-crimson hover:underline">
        {league ? `All ${league.name} standings →` : 'Full table →'}
      </Link>
    )

  return (
    <section className="mx-auto max-w-7xl px-4 pt-20 md:px-8">
      <div className="section-head">
        {tabs.length > 1 ? (
          <div role="tablist" aria-label="Games and standings" className="flex gap-6">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                id={`tab-${t.key}`}
                aria-selected={active === t.key}
                aria-controls={`panel-${t.key}`}
                onClick={() => setPicked(t.key)}
                className={`-mb-[0.8rem] min-h-11 border-b-2 pb-2 font-display text-[1.7rem] transition-colors sm:text-3xl md:text-4xl ${
                  active === t.key
                    ? 'border-crimson text-ink'
                    : 'border-transparent text-ink/35 hover:text-ink/70'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        ) : (
          <h2 className="text-3xl md:text-4xl">{tabs[0].label}</h2>
        )}
        {/* On a phone the two tabs fill the row, so the link moves below the
            panel rather than wrapping under the tabs and lifting the active
            tab's underline off the rule. */}
        <div className="ml-auto hidden sm:block">{action}</div>
      </div>

      <div
        role={tabs.length > 1 ? 'tabpanel' : undefined}
        id={`panel-${active}`}
        aria-labelledby={tabs.length > 1 ? `tab-${active}` : undefined}
      >
        {active === 'games' ? (
          <GamesGrid items={slate.items.slice(0, GAMES_SHOWN)} />
        ) : (
          <StandingsGrid tables={tables} />
        )}
      </div>
      <div className="mt-5 sm:hidden">{action}</div>
    </section>
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
  const allGames = games || []

  // Our own writing leads the page's content. It is bundled at build time, so
  // there is no loading state to design around and nothing that can fail to
  // arrive. Nothing on this page comes from other outlets any more — that
  // content moved to its own page, /wire, with no ad anywhere near it.
  const originals = getOriginals()

  // What the front page counts as current: anything live, results from the
  // last fortnight, and fixtures in the next. A league between seasons still
  // has its last results in the feed — the NBB's are from June — and those
  // are history, not a scoreboard. A scheduled game whose tip passed hours
  // ago is a snapshot that never learned the result, so it is out too.
  const now = Date.now()
  const WINDOW = 14 * 86_400_000
  const showable = allGames.filter((g) => {
    const t = new Date(g.date).getTime()
    if (g.status === 'live') return true
    if (g.status === 'final') return t >= now - WINDOW
    return t > now - 3 * 3600_000 && t <= now + WINDOW
  })

  const withStories = new Set(originals.map((a) => a.league).filter(Boolean))
  const withGames = new Set(showable.map((g) => g.league))
  const switcherLeagues = LEAGUES.filter((l) => withStories.has(l.key) || withGames.has(l.key))

  const [params, setParams] = useSearchParams()
  // An unknown ?league=, or one with nothing to show, falls back to All.
  const picked = getLeague(params.get('league'))
  const league = picked && switcherLeagues.some((l) => l.key === picked.key) ? picked : null
  const active = league?.key || null
  const pick = (key) => {
    const next = new URLSearchParams(params)
    if (key) next.set('league', key)
    else next.delete('league')
    setParams(next, { replace: true, preventScrollReset: true })
  }

  const leagueGames = active ? showable.filter((g) => g.league === active) : showable
  const stories = (active ? originals.filter((a) => a.league === active) : originals).slice(
    0,
    GRID_SIZE
  )

  const switcher = (label, className) =>
    switcherLeagues.length > 1 && (
      <LeagueSwitcher
        leagues={switcherLeagues}
        active={active}
        onPick={pick}
        label={label}
        className={className}
      />
    )

  return (
    <>
      {/*
        Scores first. They are the site's own ledger, not linked-out content,
        and checking them is why most people open a sports front page — so
        they sit above everything, where the marquee ticker used to run.
      */}
      {(showable.length > 0 || active) && (
        <ScoreStrip games={leagueGames} league={league} tabs={switcher('Filter the front page by league')} />
      )}

      <Masthead />

      {/*
        Our own writing comes before anything else that is not a score. The
        page used to open on the wire, which meant the first thing anyone saw
        on hoopspire.com — a reader, or someone deciding whether this is a
        publication — was a column of other outlets' headlines with their
        bylines on them.
      */}
      {originals.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-12 md:px-8">
          <SectionHead
            title="Latest"
            action={
              league ? (
                <Link to={`/league/${league.slug}`} className="eyebrow text-crimson hover:underline">
                  All {league.name} →
                </Link>
              ) : (
                <Link to="/archive" className="eyebrow text-crimson hover:underline">
                  Archive →
                </Link>
              )
            }
          />
          {switcher('Filter stories by league', 'mb-8')}
          {stories.length ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {stories.map((a) => (
                <ArticleCard key={a.id} article={a} variant="tile" />
              ))}
            </div>
          ) : (
            <p className="text-base text-ink/60">
              We have not written about the {league.name} yet.{' '}
              <Link to={`/league/${league.slug}`} className="text-crimson hover:underline">
                {league.name} scores, standings and teams →
              </Link>
            </p>
          )}
        </section>
      )}

      <GamesAndStandings games={leagueGames} allGames={allGames} league={league} />
    </>
  )
}

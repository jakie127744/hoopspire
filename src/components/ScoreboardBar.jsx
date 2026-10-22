import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAsync, hasLiveGame } from '../lib/useAsync.js'
import { getAllGames } from '../lib/api.js'
import { LEAGUES } from '../lib/leagues.js'
import { formatTime } from '../lib/format.js'
import { TeamLogo } from './Primitives.jsx'
import { useRouteLeague } from './Header.jsx'

/**
 * The scoreboard bar under the masthead, as ESPN runs one: a league picker
 * on the left, then a row of compact games that holds still and scrolls
 * under the reader's hand (or the arrows), then a link to the full board.
 *
 * It replaces both the marquee ticker and the front page's card strip. On a
 * league's pages it starts on that league.
 */

/**
 * What counts as current: anything live, results from the last fortnight
 * and fixtures in the next. A league between seasons still has its last
 * results in the feed, and those are history, not a scoreboard. A scheduled
 * game whose tip passed hours ago is a snapshot that never learned the
 * result, so it is out too.
 */
export function currentGames(games, now = Date.now()) {
  const WINDOW = 14 * 86_400_000
  return (games || []).filter((g) => {
    const t = new Date(g.date).getTime()
    if (g.status === 'live') return true
    if (g.status === 'final') return t >= now - WINDOW
    return t > now - 3 * 3600_000 && t <= now + WINDOW
  })
}

/** Live first, then results newest first, then the next tips. */
function order(games) {
  const live = games.filter((g) => g.status === 'live')
  const finals = games
    .filter((g) => g.status === 'final')
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 20)
  const upcoming = games
    .filter((g) => g.status === 'scheduled')
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 12)
  return [...live, ...finals, ...upcoming]
}

function statusLine(g) {
  if (g.status === 'live') {
    return (
      <span className="flex items-center gap-1 text-crimson">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-crimson" />
        {g.period ? `Q${g.period}` : 'Live'} {g.clock || ''}
      </span>
    )
  }
  if (g.status === 'final') return <span className="text-ink">Final</span>
  const d = new Date(g.date)
  if (Number.isNaN(d.getTime())) return <span>TBD</span>
  const today = d.toDateString() === new Date().toDateString()
  return (
    <span>
      {today ? '' : `${d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })} · `}
      {formatTime(d)}
    </span>
  )
}

function TeamRow({ team, score, played, won }) {
  return (
    <div className={`flex items-center gap-1.5 ${played && !won ? 'text-ink/50' : ''}`}>
      <TeamLogo team={team} size={16} />
      <span className="flex-1 truncate text-[0.8125rem] font-bold">
        {team?.abbr || team?.shortName || team?.name || 'TBD'}
      </span>
      {played && <span className="tabular text-[0.8125rem] font-extrabold">{score ?? '–'}</span>}
    </div>
  )
}

function Cell({ game, showLeague }) {
  const played = game.status !== 'scheduled'
  const h = Number(game.home?.score ?? 0)
  const a = Number(game.away?.score ?? 0)
  return (
    <Link
      to={`/game/${game.league}/${game.id}`}
      className="flex w-[8.5rem] shrink-0 snap-start flex-col justify-center gap-1 border-r border-parchment px-3 py-2 hover:bg-cream"
    >
      <div className="flex items-center justify-between gap-1 text-[0.625rem] font-bold uppercase tracking-wide text-ink/55">
        {statusLine(game)}
        {showLeague && <span className="text-ink/40">{game.league}</span>}
      </div>
      <TeamRow team={game.away} score={game.away?.score} played={played} won={a > h} />
      <TeamRow team={game.home} score={game.home?.score} played={played} won={h > a} />
    </Link>
  )
}

function Arrow({ dir, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir < 0 ? 'Earlier games' : 'Later games'}
      className="hidden w-8 shrink-0 items-center justify-center border-parchment text-ink/60 hover:bg-cream hover:text-ink md:flex"
    >
      <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
        <path d={dir < 0 ? 'M8 2 4 6l4 4' : 'M4 2l4 4-4 4'} fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    </button>
  )
}

export default function ScoreboardBar() {
  const routeLeague = useRouteLeague()
  const { data } = useAsync(() => getAllGames(), [], [], {
    refreshMs: 120_000,
    liveMs: 30_000,
    isLive: hasLiveGame,
  })
  const games = currentGames(data)
  const withGames = LEAGUES.filter((l) => games.some((g) => g.league === l.key))

  const [picked, setPicked] = useState(null)
  // A league page starts the bar on its league; leaving it resets the pick.
  useEffect(() => setPicked(null), [routeLeague?.key])
  const fallback = routeLeague && withGames.some((l) => l.key === routeLeague.key) ? routeLeague.key : 'ALL'
  const active = picked && (picked === 'ALL' || withGames.some((l) => l.key === picked)) ? picked : fallback

  const slate = order(active === 'ALL' ? games : games.filter((g) => g.league === active))
  const rail = useRef(null)
  const scroll = (dir) => rail.current?.scrollBy({ left: dir * rail.current.clientWidth * 0.8, behavior: 'smooth' })

  if (!games.length) return null

  return (
    <section aria-label="Scoreboard" className="border-b border-parchment bg-paper">
      <div className="mx-auto flex h-[4.75rem] max-w-[1440px] items-stretch">
        <div className="flex shrink-0 items-center border-r border-parchment px-2 sm:px-3">
          <label className="sr-only" htmlFor="scoreboard-league">
            League
          </label>
          <select
            id="scoreboard-league"
            value={active}
            onChange={(e) => setPicked(e.target.value)}
            className="h-9 w-[6.5rem] cursor-pointer sm:w-[8.5rem] rounded border border-parchment bg-paper pl-2 pr-6 text-xs font-extrabold uppercase tracking-wide"
          >
            <option value="ALL">All</option>
            {withGames.map((l) => (
              <option key={l.key} value={l.key}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <Arrow dir={-1} onClick={() => scroll(-1)} />
        <div ref={rail} className="no-scrollbar flex flex-1 snap-x overflow-x-auto">
          {slate.map((g) => (
            <Cell key={`${g.league}-${g.id}`} game={g} showLeague={active === 'ALL'} />
          ))}
        </div>
        <Arrow dir={1} onClick={() => scroll(1)} />

        <Link
          to={active === 'ALL' ? '/scores' : `/scores?league=${active}`}
          className="hidden shrink-0 flex-col items-center justify-center border-l border-parchment px-4 text-center text-xs font-extrabold uppercase leading-tight tracking-wide text-crimson hover:bg-cream sm:flex"
        >
          <span>Full</span>
          <span>Scoreboard</span>
        </Link>
      </div>
    </section>
  )
}

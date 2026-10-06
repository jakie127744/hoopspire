import { Link } from 'react-router-dom'
import { TeamLogo } from './Primitives.jsx'
import { formatTime } from '../lib/format.js'

/** "Today 7:30 PM" / "Wed 7:30 PM" — when an upcoming game tips, in the reader's own clock. */
function tipLabel(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  const day = sameDay ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' })
  return `${day} ${formatTime(d)}`
}

function Row({ team, score, won, played }) {
  return (
    <div className={`flex items-center gap-2 ${played && !won ? 'opacity-60' : ''}`}>
      <TeamLogo team={team} size={20} />
      <span className="flex-1 truncate text-sm font-medium">
        {team?.shortName || team?.name || 'TBD'}
      </span>
      {played && (
        <span className={`font-mono text-sm ${won ? 'font-bold' : ''}`}>{score ?? '–'}</span>
      )}
    </div>
  )
}

function StripCard({ game }) {
  const played = game.status !== 'scheduled'
  const home = game.home?.score ?? 0
  const away = game.away?.score ?? 0
  return (
    <Link
      to={`/game/${game.league}/${game.id}`}
      className="card flex w-56 shrink-0 snap-start flex-col gap-2 p-3 transition-shadow hover:shadow-[4px_4px_0_0_var(--color-parchment)]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow font-bold text-crimson">{game.league}</span>
        {game.status === 'live' ? (
          <span className="inline-flex items-center gap-1.5 bg-crimson px-1.5 py-0.5 text-paper">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-paper" />
            <span className="eyebrow font-bold">
              {game.period ? `Q${game.period}` : 'Live'} {game.clock || ''}
            </span>
          </span>
        ) : game.status === 'final' ? (
          <span className="eyebrow text-ink/45">Final</span>
        ) : (
          <span className="eyebrow text-ink/60">{tipLabel(game.date)}</span>
        )}
      </div>
      <Row team={game.away} score={game.away?.score} won={away > home} played={played} />
      <Row team={game.home} score={game.home?.score} won={home > away} played={played} />
    </Link>
  )
}

/**
 * The scoreboard strip at the top of the front page.
 *
 * It replaces the marquee ticker there: a ticker moves on its own schedule,
 * so a reader waits for the score they want to drift past. This holds still,
 * scrolls under the reader's thumb, and snaps to a card.
 *
 * Order: games in progress, then results newest first, then the next tips.
 * Every game here is a real one from the ledger; the strip does not render
 * at all when the window has none.
 */
export default function ScoreStrip({ games, league, tabs }) {
  const live = games.filter((g) => g.status === 'live')
  const finals = games.filter((g) => g.status === 'final').slice(0, 16)
  const upcoming = games
    .filter((g) => g.status === 'scheduled' && new Date(g.date).getTime() > Date.now() - 3 * 3600_000)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 8)
  const slate = [...live, ...finals, ...upcoming]

  return (
    <section aria-label="Scoreboard" className="border-b border-parchment bg-paper/60">
      <div className="mx-auto max-w-7xl px-4 py-4 md:px-8">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="eyebrow font-bold text-crimson">Scoreboard</span>
          <Link to="/scores" className="eyebrow ml-auto text-ink/60 hover:text-crimson md:order-last">
            All scores →
          </Link>
          <div className="w-full md:w-auto md:flex-1">{tabs}</div>
        </div>

        {slate.length ? (
          <div className="no-scrollbar -mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
            {slate.map((g) => (
              <StripCard key={`${g.league}-${g.id}`} game={g} />
            ))}
          </div>
        ) : (
          league && (
            <p className="mt-3 text-sm text-ink/55">
              No {league.name} games in this window.{' '}
              <Link to={`/league/${league.slug}`} className="text-crimson hover:underline">
                {league.name} schedule and standings →
              </Link>
            </p>
          )
        )}
      </div>
    </section>
  )
}

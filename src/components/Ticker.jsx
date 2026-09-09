import { Link } from 'react-router-dom'
import { useAsync, hasLiveGame } from '../lib/useAsync.js'
import { getAllGames } from '../lib/api.js'

/** "Sep 25" — enough to place an upcoming fixture without crowding the rail. */
function shortDate(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * The scrolling score rail under the masthead.
 *
 * The track is rendered twice and translated -50% so the loop is seamless;
 * hovering pauses it so a score can actually be read.
 */
export default function Ticker() {
  const { data: games } = useAsync(() => getAllGames(), [], [], {
    refreshMs: 120_000,
    liveMs: 30_000,
    isLive: hasLiveGame,
  })
  // Lead with anything in progress, then results, then fixtures. A rail of
  // 0-0 scheduled games reads like broken data, so upcoming ones only fill in
  // when there aren't enough played games to carry it.
  const all = games || []
  const live = all.filter((g) => g.status === 'live')
  const finals = all.filter((g) => g.status === 'final')
  const upcoming = all.filter((g) => g.status === 'scheduled')
  const played = [...live, ...finals]
  const slate = [...played, ...upcoming].slice(0, Math.max(24, played.length ? 0 : 12))

  if (!slate.length) return null

  const track = [...slate, ...slate]

  return (
    <div className="relative overflow-hidden border-b border-parchment bg-ink text-cream">
      <div className="pointer-events-none absolute left-0 top-0 z-10 flex h-full items-center bg-crimson px-3">
        <span className="eyebrow font-bold">Live</span>
      </div>

      <div className="flex w-max animate-ticker">
        {track.map((g, i) => (
          <Link
            key={`${g.id}-${i}`}
            to={`/game/${g.league}/${g.id}`}
            className="flex shrink-0 items-center gap-2 border-r border-cream/10 px-5 py-2 transition-colors hover:bg-cream/10"
          >
            <span className="eyebrow text-gold">{g.league}</span>
            <span className="eyebrow text-cream/60">{g.away?.abbr || g.away?.name}</span>
            {g.status !== 'scheduled' && (
              <span className="font-mono text-xs font-bold">{g.away?.score ?? '–'}</span>
            )}
            <span className="text-cream/30">@</span>
            <span className="eyebrow text-cream/60">{g.home?.abbr || g.home?.name}</span>
            {g.status !== 'scheduled' ? (
              <span className="font-mono text-xs font-bold">{g.home?.score ?? '–'}</span>
            ) : (
              <span className="eyebrow text-cream/35">{shortDate(g.date)}</span>
            )}
            {g.status === 'final' && <span className="eyebrow text-cream/35">Final</span>}
            {g.status === 'live' && (
              <span className="eyebrow font-bold text-gold">
                {g.clock} Q{g.period}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}

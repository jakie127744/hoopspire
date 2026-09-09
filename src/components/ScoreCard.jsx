import { Link } from 'react-router-dom'
import { TeamLogo, StatusPill } from './Primitives.jsx'
import { formatDate, formatTime } from '../lib/format.js'

function Side({ team, winner, showScore }) {
  return (
    <div className={`flex items-center gap-3 ${winner ? '' : 'opacity-70'}`}>
      <TeamLogo team={team} size={28} />
      <span className="eyebrow flex-1 truncate">{team?.name || 'TBD'}</span>
      {showScore ? (
        <span className={`font-mono text-lg ${winner ? 'font-bold' : ''}`}>
          {team?.score ?? '–'}
        </span>
      ) : (
        <span className="font-mono text-xs text-ink/40">{team?.record || ''}</span>
      )}
    </div>
  )
}

export default function ScoreCard({ game }) {
  const played = game.status !== 'scheduled'
  const homeWon = played && (game.home?.score ?? 0) > (game.away?.score ?? 0)
  const awayWon = played && (game.away?.score ?? 0) > (game.home?.score ?? 0)

  return (
    <Link
      to={`/game/${game.league}/${game.id}`}
      className="card flex flex-col gap-3 p-4 transition-shadow hover:shadow-[4px_4px_0_0_var(--color-parchment)]"
    >
      <div className="flex items-center justify-between">
        <span className="eyebrow font-bold text-crimson">{game.league}</span>
        <StatusPill game={game} />
      </div>

      <div className="flex flex-col gap-2">
        <Side team={game.away} winner={awayWon} showScore={played} />
        <Side team={game.home} winner={homeWon} showScore={played} />
      </div>

      <div className="rule" />

      <div className="flex items-center justify-between gap-2 text-ink/45">
        <span className="eyebrow truncate">{game.venue || game.city || '—'}</span>
        <span className="eyebrow shrink-0">
          {game.status === 'scheduled'
            ? `${formatDate(game.date)} · ${formatTime(game.date)}`
            : formatDate(game.date)}
        </span>
      </div>
    </Link>
  )
}

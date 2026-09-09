import { useParams, Link } from 'react-router-dom'
import { getLeague } from '../lib/leagues.js'
import { useAsync } from '../lib/useAsync.js'
import { getGame } from '../lib/api.js'
import { TeamLogo, Loading, Empty, Eyebrow, SectionHead, StatusPill } from '../components/Primitives.jsx'
import { formatDate, formatTime } from '../lib/format.js'

function Scoreline({ game }) {
  const played = game.status !== 'scheduled'
  const periods = Math.max(
    game.home?.linescores?.length || 0,
    game.away?.linescores?.length || 0
  )

  // Class names are written out in full — Tailwind scans source text, so
  // interpolated names like `items-${align}` would never be generated.
  const Row = ({ side, align }) => (
    <div
      className={`flex flex-1 flex-col gap-3 ${
        align === 'start' ? 'items-start text-left' : 'items-end text-right'
      }`}
    >
      <TeamLogo team={side} size={72} />
      <div>
        <p className="font-display text-2xl leading-tight md:text-3xl">{side?.name || 'TBD'}</p>
        {side?.record && <p className="eyebrow mt-1 text-ink/40">{side.record}</p>}
      </div>
    </div>
  )

  return (
    <div className="card p-6 md:p-10">
      <div className="flex items-center justify-between">
        <Eyebrow className="font-bold text-crimson">{game.league}</Eyebrow>
        <StatusPill game={game} />
      </div>

      <div className="mt-8 flex items-start gap-6">
        <Row side={game.away} align="start" />
        <div className="shrink-0 text-center">
          {played ? (
            <p className="font-mono text-4xl font-bold md:text-6xl">
              {game.away?.score ?? '–'}
              <span className="mx-2 text-ink/25">–</span>
              {game.home?.score ?? '–'}
            </p>
          ) : (
            <p className="font-display text-3xl text-ink/50">{formatTime(game.date)}</p>
          )}
          <p className="eyebrow mt-2 text-ink/40">{game.statusDetail}</p>
        </div>
        <Row side={game.home} align="end" />
      </div>

      {periods > 0 && (
        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[380px] border-collapse">
            <thead>
              <tr className="border-b border-parchment">
                <th className="eyebrow py-2 text-left text-ink/50">Team</th>
                {Array.from({ length: periods }, (_, i) => (
                  <th key={i} className="eyebrow py-2 text-right text-ink/50">
                    {i < 4 ? `Q${i + 1}` : `OT${i - 3}`}
                  </th>
                ))}
                <th className="eyebrow py-2 text-right text-ink/50">T</th>
              </tr>
            </thead>
            <tbody>
              {[game.away, game.home].map((side, si) => (
                <tr key={si} className="border-b border-parchment last:border-0">
                  <td className="py-2 text-sm font-medium">{side?.abbr || side?.name}</td>
                  {Array.from({ length: periods }, (_, i) => (
                    <td key={i} className="py-2 text-right font-mono text-sm">
                      {side?.linescores?.[i] ?? '–'}
                    </td>
                  ))}
                  <td className="py-2 text-right font-mono text-sm font-bold">
                    {side?.score ?? '–'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-x-8 gap-y-2 border-t border-parchment pt-6">
        {[
          ['Date', formatDate(game.date, { weekday: 'short' })],
          ['Tip-off', formatTime(game.date)],
          ['Venue', game.venue],
          ['City', game.city],
          ['Broadcast', game.broadcast],
          ['Attendance', game.attendance ? game.attendance.toLocaleString() : null],
        ]
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k}>
              <Eyebrow className="text-ink/40">{k}</Eyebrow>
              <p className="mt-0.5 text-sm">{v}</p>
            </div>
          ))}
      </div>
    </div>
  )
}

function BoxScore({ side }) {
  if (!side.players?.length) return null
  return (
    <div className="mt-10">
      <div className="mb-3 flex items-center gap-3">
        <TeamLogo team={side.team} size={28} />
        <h3 className="font-display text-2xl">{side.team.name}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-ink">
              <th className="eyebrow py-2 text-left text-ink/50">Player</th>
              {side.labels.map((l) => (
                <th key={l} className="eyebrow py-2 text-right text-ink/50">
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {side.players
              .filter((p) => !p.didNotPlay)
              .map((p) => (
                <tr key={p.id} className="border-b border-parchment">
                  <td className="py-2 text-sm">
                    <span className="font-medium">{p.name}</span>
                    <span className="eyebrow ml-2 text-ink/35">{p.position}</span>
                    {p.starter && <span className="ml-1 text-gold">★</span>}
                  </td>
                  {p.stats.map((s, i) => (
                    <td key={i} className="py-2 text-right font-mono text-xs">
                      {s}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function Game() {
  const { leagueKey, gameId } = useParams()
  const league = getLeague(leagueKey)
  // A game in progress re-reads its own box score every 20 seconds.
  const { data, loading } = useAsync(
    () => getGame(leagueKey, gameId),
    [leagueKey, gameId],
    null,
    { refreshMs: 300_000, liveMs: 20_000, isLive: (d) => d?.game?.status === 'live' }
  )

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-24 md:px-8">
        <Loading label="Opening the box score" />
      </div>
    )
  }

  if (!data?.game) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-24 md:px-8">
        <h1 className="text-4xl">Game not found.</h1>
        <Link to="/scores" className="eyebrow mt-6 inline-block text-crimson">
          ← Back to the scoreboard
        </Link>
      </div>
    )
  }

  const { game, boxscore, recap } = data

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 md:px-8">
      <Link to="/scores" className="eyebrow text-ink/45 hover:text-crimson">
        ← Scoreboard
      </Link>

      <div className="mt-6">
        <Scoreline game={game} />
      </div>

      {recap && (
        <section className="mt-16">
          <SectionHead title="Recap" />
          <h3 className="font-display text-3xl leading-tight">{recap.title}</h3>
          <p className="eyebrow mt-3 text-ink/45">
            {recap.byline ? `By ${recap.byline} · ` : ''}
            {formatDate(recap.published)}
          </p>
          <div
            className="prose mt-6 max-w-none text-ink/75 [&_a]:text-crimson [&_p]:mb-4"
            dangerouslySetInnerHTML={{ __html: recap.body }}
          />
        </section>
      )}

      {boxscore?.length > 0 ? (
        <section className="mt-16">
          <SectionHead title="Box Score" />
          {boxscore.map((side) => (
            <BoxScore key={side.team.id} side={side} />
          ))}
        </section>
      ) : (
        game.status === 'final' && (
          <section className="mt-16">
            <SectionHead title="Box Score" />
            <Empty
              title="No box score published for this game."
              hint={
                league?.source === 'snapshot'
                  ? 'Snapshot leagues capture results and schedules, not player-level box scores.'
                  : undefined
              }
            />
          </section>
        )
      )}
    </div>
  )
}

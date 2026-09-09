import { Link } from 'react-router-dom'
import { TeamLogo, Eyebrow, Empty } from './Primitives.jsx'

/**
 * The bracket implied by the standings as they stand.
 *
 * Seeds 7-10 are drawn as a play-in tournament rather than folded into the
 * first round, because they are not settled. The first-round pairings that
 * depend on a play-in result are marked provisional for the same reason.
 */

function Side({ row, seed, leagueKey, dim }) {
  if (!row) {
    return (
      <div className="flex items-center gap-3 py-2 opacity-45">
        <span className="w-5 shrink-0 font-mono text-xs text-ink/40">{seed ?? '—'}</span>
        <span className="h-6 w-6 shrink-0 border border-dashed border-parchment" />
        <span className="text-sm italic text-ink/50">To be decided</span>
      </div>
    )
  }
  return (
    <Link
      to={`/team/${leagueKey}/${row.team.id}`}
      className={`flex items-center gap-3 py-2 hover:text-crimson ${dim ? 'opacity-70' : ''}`}
    >
      <span className="w-5 shrink-0 font-mono text-xs text-ink/40">{seed ?? row.seed}</span>
      <TeamLogo team={row.team} size={24} />
      <span className="flex-1 truncate text-sm font-medium">{row.team.name}</span>
      <span className="shrink-0 font-mono text-xs text-ink/50">
        {row.wins}-{row.losses}
      </span>
    </Link>
  )
}

function Series({ s, leagueKey }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <Eyebrow className="text-ink/40">
          {s.highSeed} v {s.lowSeed}
        </Eyebrow>
        {s.provisional && (
          <Eyebrow className="text-gold" title="Depends on the play-in result">
            Provisional
          </Eyebrow>
        )}
      </div>
      <div className="mt-1 divide-y divide-parchment">
        <Side row={s.high} seed={s.highSeed} leagueKey={leagueKey} />
        <Side row={s.low} seed={s.lowSeed} leagueKey={leagueKey} dim={s.provisional} />
      </div>
    </div>
  )
}

export default function PlayoffPicture({ picture, leagueKey, seasonLabel }) {
  if (!picture?.groups?.length) {
    return <Empty title="No playoff picture available for this league yet." />
  }

  return (
    <div>
      <p className="mb-8 max-w-2xl text-sm text-ink/60">
        The bracket the current standings would produce
        {seasonLabel ? ` (${seasonLabel})` : ''}. Seeds 7 to 10 must come through the play-in
        tournament first, so any first-round pairing that depends on it is marked provisional —
        those matchups are not settled.
      </p>

      <div className="grid gap-12 lg:grid-cols-2">
        {picture.groups.map((g) => (
          <section key={g.name}>
            <h3 className="border-b border-ink pb-2 font-display text-2xl">{g.name}</h3>

            <div className="mt-5">
              <Eyebrow className="text-ink/45">First round</Eyebrow>
              <div className="mt-3 grid gap-3">
                {g.series.map((s) => (
                  <Series key={`${s.highSeed}-${s.lowSeed}`} s={s} leagueKey={leagueKey} />
                ))}
              </div>
            </div>

            {g.playInGames.length > 0 && (
              <div className="mt-8">
                <Eyebrow className="text-crimson">Play-in tournament</Eyebrow>
                <div className="mt-3 grid gap-3">
                  {g.playInGames.map((game) => (
                    <div key={game.id} className="border border-dashed border-parchment p-4">
                      <div className="flex items-center justify-between">
                        <Eyebrow className="text-ink/40">Game {game.id}</Eyebrow>
                        <Eyebrow className="text-ink/40">{game.stake}</Eyebrow>
                      </div>
                      {game.home || game.away ? (
                        <div className="mt-1 divide-y divide-parchment">
                          <Side row={game.home} leagueKey={leagueKey} />
                          <Side row={game.away} leagueKey={leagueKey} />
                        </div>
                      ) : (
                        <p className="mt-2 text-sm italic text-ink/50">{game.label}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {g.out.length > 0 && (
              <div className="mt-8">
                <Eyebrow className="text-ink/40">Outside the picture · {g.out.length}</Eyebrow>
                <p className="mt-2 text-sm text-ink/55">
                  {g.out.map((r) => r.team.abbr || r.team.name).join(' · ')}
                </p>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}

import { useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getLeague } from '../lib/leagues.js'
import { useAsync } from '../lib/useAsync.js'
import { getPlayer } from '../lib/players.js'
import { TeamLogo, Loading, Eyebrow, SectionHead } from '../components/Primitives.jsx'
import { formatDate, initials } from '../lib/format.js'

const LINE = [
  ['gamesPlayed', 'GP'],
  ['minutes', 'MPG'],
  ['points', 'PPG'],
  ['rebounds', 'RPG'],
  ['assists', 'APG'],
  ['steals', 'SPG'],
  ['blocks', 'BPG'],
  ['fgPct', 'FG%'],
  ['threePct', '3P%'],
  ['ftPct', 'FT%'],
]

function Headshot({ player }) {
  if (player.headshot) {
    return (
      <img
        src={player.headshot}
        alt=""
        className="h-28 w-28 shrink-0 rounded-full border border-parchment bg-parchment object-cover md:h-36 md:w-36"
      />
    )
  }
  return (
    <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full border border-parchment bg-paper font-display text-4xl text-ink/40 md:h-36 md:w-36">
      {initials(player.name)}
    </div>
  )
}

/** The headline numbers, as a row of large figures. */
function SeasonLine({ season }) {
  const cells = LINE.filter(([k]) => season[k] != null && season[k] !== '')
  return (
    <section className="mt-12">
      <SectionHead title="This season">
        <Eyebrow className="text-ink/40">{season.label}</Eyebrow>
      </SectionHead>
      <div className="grid grid-cols-3 gap-px border border-parchment bg-parchment sm:grid-cols-5">
        {cells.map(([k, label]) => (
          <div key={k} className="bg-paper px-4 py-4">
            <p className="font-mono text-3xl">{season[k]}</p>
            <Eyebrow className="text-ink/40">{label}</Eyebrow>
          </div>
        ))}
      </div>
    </section>
  )
}

/** "BSN → LNB Pro A → VTB → CBA" — the background at a glance. */
function Path({ path }) {
  if (path.length < 2) return null
  return (
    <div className="mt-6 flex flex-wrap items-center gap-2">
      <Eyebrow className="mr-1 text-gold">Path</Eyebrow>
      {path.map((league, i) => (
        <span key={`${league}-${i}`} className="flex items-center gap-2">
          {i > 0 && <span className="text-ink/30">→</span>}
          <span className="border border-parchment bg-paper px-2 py-0.5 text-sm">{league}</span>
        </span>
      ))}
    </div>
  )
}

function CareerTable({ rows, showLeague = true, teamLabel = 'Team' }) {
  const head = ['Season', teamLabel, ...(showLeague ? ['League'] : []), 'GP', 'MIN', 'PTS', 'REB', 'AST']
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse">
        <thead>
          <tr className="border-b border-ink">
            {head.map((h, i) => (
              <th key={h} className={`eyebrow py-2 text-ink/50 ${i < (showLeague ? 3 : 2) ? 'text-left' : 'text-right'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...rows].reverse().map((r, i) => (
            <tr
              key={`${r.season}-${r.team}-${i}`}
              className={`border-b border-parchment ${r.isTotal ? 'bg-paper' : ''}`}
            >
              <td className="py-2 font-mono text-xs text-ink/60">{r.season}</td>
              <td className={`py-2 text-sm ${r.isTotal ? 'italic text-ink/55' : ''}`}>{r.team}</td>
              {showLeague && <td className="py-2 text-sm text-ink/60">{r.league}</td>}
              {['gamesPlayed', 'minutes', 'points', 'rebounds', 'assists'].map((k) => (
                <td key={k} className="py-2 text-right font-mono text-xs">
                  {r[k] == null ? '—' : k === 'gamesPlayed' ? r[k] : Number(r[k]).toFixed(1)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Player() {
  const { leagueKey, playerId } = useParams()
  const league = getLeague(leagueKey)
  const { data: p, loading } = useAsync(
    () => getPlayer(leagueKey, decodeURIComponent(playerId)),
    [leagueKey, playerId],
    null
  )

  useEffect(() => {
    if (!p?.name) return
    const prev = document.title
    document.title = `${p.name} — Hoopspire`
    return () => {
      document.title = prev
    }
  }, [p?.name])

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-24 md:px-8">
        <Loading label="Pulling the file" />
      </div>
    )
  }

  if (!p) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-24 md:px-8">
        <h1 className="text-4xl">No profile for this player yet.</h1>
        <p className="mt-3 text-ink/60">
          Profiles are built from the league's own feeds and RealGM. This player is not in either.
        </p>
        <Link to="/stats" className="eyebrow mt-6 inline-block text-crimson">
          ← Stats
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 md:px-8">
      <Link to="/stats" className="eyebrow text-ink/45 hover:text-crimson">
        ← Stats
      </Link>

      <header className="mt-6 flex flex-wrap items-center gap-6 border-b border-ink pb-8 md:gap-8">
        <Headshot player={p} />
        <div className="min-w-0 flex-1">
          <Eyebrow className="text-crimson">
            {league?.name}
            {p.position ? ` · ${p.position}` : ''}
            {p.jersey ? ` · #${p.jersey}` : ''}
          </Eyebrow>
          <h1 className="mt-2 text-5xl leading-none md:text-6xl">{p.name}</h1>
          {p.nameLocal && <p className="mt-2 text-ink/50">{p.nameLocal}</p>}
          {p.team &&
            (p.team.id ? (
              <Link
                to={`/team/${p.league}/${p.team.id}`}
                className="mt-4 inline-flex items-center gap-2 hover:text-crimson"
              >
                <TeamLogo team={p.team} size={24} />
                <span className="text-sm font-medium">{p.team.name}</span>
              </Link>
            ) : (
              <p className="mt-4 text-sm font-medium">{p.team.name}</p>
            ))}
          <Path path={p.path} />
        </div>
      </header>

      {p.bio.length > 0 && (
        <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
          {p.bio.map((b) => (
            <div key={b.label}>
              <dt className="eyebrow text-ink/40">{b.label}</dt>
              <dd className="mt-0.5 text-sm">{b.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {p.season && <SeasonLine season={p.season} />}

      {p.career.length > 0 && (
        <section className="mt-16">
          <SectionHead title="Where they've played">
            <Eyebrow className="text-ink/40">
              {new Set(p.career.map((r) => r.season)).size} seasons · per game
            </Eyebrow>
          </SectionHead>
          <CareerTable rows={p.career} />
          {p.careerMissingGLeague && (
            <p className="mt-3 text-xs text-ink/50">
              G League seasons are not yet included for this player; they arrive with the next
              careers refresh.{' '}
              {p.careerUrl && (
                <a href={p.careerUrl} rel="noreferrer" className="text-crimson underline">
                  Full career on RealGM
                </a>
              )}
            </p>
          )}
        </section>
      )}

      {p.college.length > 0 && (
        <section className="mt-16">
          <SectionHead title="College" />
          <CareerTable rows={p.college} showLeague={false} teamLabel="School" />
        </section>
      )}

      {p.gameLog.length > 0 && (
        <section className="mt-16">
          <SectionHead title="Last ten games" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse">
              <thead>
                <tr className="border-b border-ink">
                  {['Date', 'Opp', 'Result', 'MIN', 'PTS', 'REB', 'AST'].map((h, i) => (
                    <th key={h} className={`eyebrow py-2 text-ink/50 ${i < 3 ? 'text-left' : 'text-right'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {p.gameLog.map((g, i) => (
                  <tr key={i} className="border-b border-parchment">
                    <td className="py-2 font-mono text-xs text-ink/60">{formatDate(g.date, { year: undefined })}</td>
                    <td className="py-2 text-sm">
                      {g.atVs === '@' ? '@ ' : 'v '}
                      {g.opponent}
                    </td>
                    <td className={`py-2 text-sm ${String(g.result).startsWith('W') ? 'text-crimson' : 'text-ink/55'}`}>
                      {g.result}
                    </td>
                    {['minutes', 'points', 'rebounds', 'assists'].map((k) => (
                      <td key={k} className="py-2 text-right font-mono text-xs">
                        {g[k] ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {p.transactions.length > 0 && (
        <section className="mt-16">
          <SectionHead title="Moves" />
          <ul className="divide-y divide-parchment border-t border-parchment">
            {p.transactions.slice(0, 10).map((t, i) => (
              <li key={i} className="flex gap-6 py-3 text-sm">
                <span className="w-28 shrink-0 font-mono text-xs text-ink/50">{t.date}</span>
                <span className="text-ink/75">{t.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {p.awards.length > 0 && (
        <section className="mt-16">
          <SectionHead title="Honours" />
          <ul className="grid gap-2 sm:grid-cols-2">
            {p.awards.slice(0, 12).map((a, i) => (
              <li key={i} className="border border-parchment bg-paper px-4 py-2 text-sm">
                {a.award}
                {a.date && <span className="eyebrow ml-2 text-ink/40">{a.date}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!p.career.length && p.careerUrl && (
        <p className="mt-16 border-l-2 border-gold bg-paper px-5 py-4 text-sm text-ink/70">
          Career history for this player has not been captured yet.{' '}
          <a href={p.careerUrl} rel="noreferrer" className="text-crimson underline">
            See their full career on RealGM
          </a>
          .
        </p>
      )}

      <footer className="mt-16 border-t border-parchment pt-6">
        <p className="text-sm text-ink/50">
          Sources:{' '}
          {p.sources.map((s, i) => (
            <span key={s.name}>
              {i > 0 && ', '}
              <a href={s.url} rel="noreferrer" className="underline hover:text-crimson">
                {s.name}
              </a>
            </span>
          ))}
          {p.careerUrl && p.career.length > 0 && (
            <>
              {' · '}
              <a href={p.careerUrl} rel="noreferrer" className="underline hover:text-crimson">
                Full career on RealGM
              </a>
            </>
          )}
        </p>
      </footer>
    </div>
  )
}

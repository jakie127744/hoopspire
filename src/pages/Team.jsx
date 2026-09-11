import { useParams, Link } from 'react-router-dom'
import { getLeague } from '../lib/leagues.js'
import { useAsync } from '../lib/useAsync.js'
import { getRoster, getGames } from '../lib/api.js'
import { rosterProfileIds, playerHref } from '../lib/players.js'
import { TeamLogo, Loading, Empty, Eyebrow, SectionHead } from '../components/Primitives.jsx'
import ScoreCard from '../components/ScoreCard.jsx'

const COLUMNS = [
  ['jersey', '#'],
  ['name', 'Player'],
  ['position', 'Pos'],
  ['height', 'Ht'],
  ['weight', 'Wt'],
  ['age', 'Age'],
  ['country', 'From'],
]

export default function Team() {
  const { leagueKey, teamId } = useParams()
  const league = getLeague(leagueKey)

  const { data: roster, loading } = useAsync(
    () => getRoster(leagueKey, teamId),
    [leagueKey, teamId],
    null
  )
  const { data: games } = useAsync(() => getGames(leagueKey), [leagueKey], [])
  const { data: profileIds } = useAsync(
    () => (roster?.players ? rosterProfileIds(leagueKey, roster.players) : new Map()),
    // Keyed on the roster object itself, not its length: two teams with the
    // same squad size would otherwise reuse the previous team's links.
    [leagueKey, teamId, roster],
    new Map()
  )

  const teamGames = (games || [])
    .filter(
      (g) => String(g.home?.id) === String(teamId) || String(g.away?.id) === String(teamId)
    )
    .slice(0, 4)

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-24 md:px-8">
        <Loading label="Opening the team sheet" />
      </div>
    )
  }

  if (!roster) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-24 md:px-8">
        <h1 className="text-4xl">Roster unavailable.</h1>
        <p className="mt-3 text-ink/60">
          {league?.source === 'snapshot'
            ? 'This league is snapshot-backed — run `npm run data` to capture rosters.'
            : 'The league feed did not return this team.'}
        </p>
        <Link to="/teams" className="eyebrow mt-6 inline-block text-crimson">
          ← All teams
        </Link>
      </div>
    )
  }

  const { team, players, coach, season } = roster

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 md:px-8">
      <Link to="/teams" className="eyebrow text-ink/45 hover:text-crimson">
        ← All teams
      </Link>

      <header className="mt-6 flex flex-wrap items-center gap-6 border-b border-ink pb-8">
        <TeamLogo team={team} size={88} />
        <div>
          <Eyebrow className="text-crimson">
            {league?.name} · {season || 'Current season'}
          </Eyebrow>
          <h1 className="mt-2 text-5xl md:text-6xl">{team.name}</h1>
          {coach && <p className="mt-2 text-ink/60">Head coach · {coach}</p>}
        </div>
        <div className="ml-auto text-right">
          <p className="font-mono text-4xl">{players.length}</p>
          <Eyebrow className="text-ink/40">On roster</Eyebrow>
        </div>
      </header>

      <section className="mt-12">
        <SectionHead title="Roster" />
        {players.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-ink">
                  {COLUMNS.map(([k, label], i) => (
                    <th
                      key={k}
                      className={`eyebrow py-2 text-ink/50 ${i <= 1 ? 'text-left' : 'text-right'}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.id || p.name} className="border-b border-parchment">
                    <td className="w-12 py-2.5 font-mono text-xs text-ink/40">{p.jersey || '—'}</td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-3">
                        {p.headshot ? (
                          <img
                            src={p.headshot}
                            alt=""
                            loading="lazy"
                            className="h-9 w-9 rounded-full bg-parchment object-cover"
                          />
                        ) : (
                          <span className="h-9 w-9 rounded-full bg-parchment" />
                        )}
                        {playerHref(leagueKey, profileIds?.get(String(p.id ?? p.name))) ? (
                          <Link
                            to={playerHref(leagueKey, profileIds.get(String(p.id ?? p.name)))}
                            className="text-sm font-medium hover:text-crimson"
                          >
                            {p.name}
                          </Link>
                        ) : (
                          <span className="text-sm font-medium">{p.name}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 text-right font-mono text-xs">{p.position || '—'}</td>
                    <td className="py-2.5 text-right font-mono text-xs">{p.height || '—'}</td>
                    <td className="py-2.5 text-right font-mono text-xs">{p.weight || '—'}</td>
                    <td className="py-2.5 text-right font-mono text-xs">{p.age ?? '—'}</td>
                    <td className="py-2.5 text-right text-xs text-ink/55">
                      {p.country || p.college || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Roster not published." />
        )}
      </section>

      {teamGames.length > 0 && (
        <section className="mt-20">
          <SectionHead title="Recent & Upcoming" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {teamGames.map((g) => (
              <ScoreCard key={g.id} game={g} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

import { Link } from 'react-router-dom'
import { TeamLogo, Empty } from './Primitives.jsx'

const HEAD = ['#', 'Team', 'W', 'L', 'PCT', 'PF', 'PA', 'DIFF', 'STRK']

export default function StandingsTable({ standings, leagueKey, limit }) {
  const rows = standings?.rows || []
  if (!rows.length) {
    return <Empty title="Standings not published yet." />
  }

  const shown = limit ? rows.slice(0, limit) : rows

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr className="border-b border-ink">
            {HEAD.map((h, i) => (
              <th
                key={h}
                className={`eyebrow py-2 text-ink/50 ${
                  i === 1 ? 'text-left' : i === 0 ? 'w-10 text-left' : 'text-right'
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr key={r.team.id ?? r.team.name} className="border-b border-parchment">
              {/* Position in this table — ESPN's playoffSeed is per-conference
                  and would repeat 1,2,1,2 in a league-wide list. */}
              <td className="py-2.5 font-mono text-xs text-ink/40">{i + 1}</td>
              <td className="py-2.5">
                <Link
                  to={`/team/${leagueKey}/${r.team.id}`}
                  className="flex items-center gap-2.5 hover:text-crimson"
                >
                  <TeamLogo team={r.team} size={22} />
                  <span className="truncate text-sm font-medium">{r.team.name}</span>
                </Link>
              </td>
              <td className="py-2.5 text-right font-mono text-sm font-bold">{r.wins}</td>
              <td className="py-2.5 text-right font-mono text-sm">{r.losses}</td>
              <td className="py-2.5 text-right font-mono text-sm">{r.pct}</td>
              <td className="py-2.5 text-right font-mono text-xs text-ink/60">
                {r.pointsFor ?? '—'}
              </td>
              <td className="py-2.5 text-right font-mono text-xs text-ink/60">
                {r.pointsAgainst ?? '—'}
              </td>
              <td
                className={`py-2.5 text-right font-mono text-xs ${
                  String(r.diff).startsWith('-') ? 'text-ink/50' : 'text-crimson'
                }`}
              >
                {r.diff ?? '—'}
              </td>
              <td className="py-2.5 text-right font-mono text-xs text-ink/50">
                {r.streak ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

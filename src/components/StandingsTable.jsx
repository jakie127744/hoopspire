import { Link } from 'react-router-dom'
import { TeamLogo, Empty } from './Primitives.jsx'

const FULL = ['#', 'Team', 'W', 'L', 'PCT', 'GB', 'DIFF', 'STRK']
const COMPACT = ['#', 'Team', 'W', 'L', 'PCT']

/**
 * @param seedFrom  'group' uses the seed ESPN assigned within its group
 *                  (conference), which is what playoff seeding follows.
 *                  Anything else numbers by table position, because a
 *                  conference seed repeats 1,2,1,2 in a league-wide list.
 */
export default function StandingsTable({ standings, leagueKey, limit, compact, seedFrom }) {
  const HEAD = compact ? COMPACT : FULL
  const rows = standings?.rows || []
  if (!rows.length) {
    return <Empty title="Standings not published yet." />
  }

  const shown = limit ? rows.slice(0, limit) : rows

  return (
    <div className="overflow-x-auto">
      <table className={`w-full border-collapse ${compact ? 'min-w-[300px]' : 'min-w-[560px]'}`}>
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
              <td className="py-2.5 font-mono text-xs text-ink/40">
                {seedFrom === 'group' ? (r.seed ?? i + 1) : i + 1}
              </td>
              <td className="py-2.5">
                <Link
                  to={`/team/${leagueKey}/${r.team.id}`}
                  className="flex items-center gap-2.5 hover:text-crimson"
                >
                  <TeamLogo team={r.team} size={22} />
                  <span className="truncate text-sm font-medium">
                    {compact ? r.team.shortName || r.team.name : r.team.name}
                  </span>
                  {r.clincher && (
                    <span
                      className="shrink-0 font-mono text-[10px] uppercase text-gold"
                      title="ESPN clinch marker"
                    >
                      {r.clincher}
                    </span>
                  )}
                </Link>
              </td>
              <td className="py-2.5 text-right font-mono text-sm font-bold">{r.wins}</td>
              <td className="py-2.5 text-right font-mono text-sm">{r.losses}</td>
              <td className="py-2.5 text-right font-mono text-sm">{r.pct}</td>
              {!compact && (
                <>
                  <td className="py-2.5 text-right font-mono text-xs text-ink/60">
                    {r.gamesBehind ?? '—'}
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
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

import { Link } from 'react-router-dom'
import { TeamLogo, Empty } from './Primitives.jsx'

const FULL = ['#', 'Team', 'W', 'L', 'PCT', 'GB', 'DIFF', 'STRK']
const COMPACT = ['#', 'Team', 'W', 'L', 'PCT']

/**
 * Where a seed lands under a league's postseason format: 'playoff' for the
 * outright berths, 'playin' for the play-in range, 'out' for the rest.
 */
function zoneOf(seed, format) {
  if (!format || seed == null) return null
  if (seed <= format.berths) return 'playoff'
  if (format.playIn && seed >= format.playIn[0] && seed <= format.playIn[1]) return 'playin'
  return 'out'
}

const ZONE_BAR = {
  playoff: 'border-l-crimson',
  playin: 'border-l-ink/45',
  out: 'border-l-transparent',
}

/** The key under a table that marks playoff, play-in and out. */
export function ZoneLegend({ format, className = '' }) {
  if (!format) return null
  const item = (cls, label) => (
    <span className="flex items-center gap-1.5">
      <span className={`h-3 w-[3px] rounded-full ${cls}`} aria-hidden="true" />
      {label}
    </span>
  )
  return (
    <p className={`flex flex-wrap gap-x-4 gap-y-1 text-[0.6875rem] font-semibold text-ink/55 ${className}`}>
      {item('bg-crimson', `Playoffs (1–${format.berths})`)}
      {format.playIn && item('bg-ink/45', `Play-In (${format.playIn[0]}–${format.playIn[1]})`)}
      {item('bg-parchment', 'Out')}
    </p>
  )
}

/**
 * @param seedFrom  'group' uses the seed ESPN assigned within its group
 *                  (conference), which is what playoff seeding follows.
 *                  Anything else numbers by table position, because a
 *                  conference seed repeats 1,2,1,2 in a league-wide list.
 * @param zones     the league's playoffFormat. With a conference table
 *                  (seedFrom 'group') it marks each row as playoff, play-in
 *                  or out, with a rule under the last seed of each band.
 */
export default function StandingsTable({ standings, leagueKey, limit, compact, seedFrom, zones }) {
  const HEAD = compact ? COMPACT : FULL
  const rows = standings?.rows || []
  if (!rows.length) {
    return <Empty title="Standings not published yet." />
  }

  const shown = limit ? rows.slice(0, limit) : rows
  // ESPN's conference seeds, unless they tie. Early in a season it hands a
  // dozen 0-0 teams the same seed, and then position in the table (already
  // sorted by seed, then record) is the only honest number to show.
  const useSeeds =
    seedFrom === 'group' && new Set(shown.map((r) => r.seed)).size === shown.length

  return (
    <div className="overflow-x-auto">
      <table className={`w-full border-collapse ${compact ? 'min-w-[240px]' : 'min-w-[560px]'}`}>
        <thead>
          <tr className="border-b border-parchment">
            {HEAD.map((h, i) => (
              <th
                key={h}
                className={`eyebrow py-2 text-ink/50 ${
                  i === 1 ? 'text-left' : i === 0 ? 'w-10 text-left' : 'pl-3 text-right'
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => {
            const seedAt = (j) => (useSeeds ? (shown[j]?.seed ?? j + 1) : j + 1)
            const seed = seedAt(i)
            const format = seedFrom === 'group' ? zones : null
            const zone = zoneOf(seed, format)
            const nextZone = zoneOf(seedAt(i + 1), format)
            // A firmer rule where one band ends and the next begins.
            const edge = zone && i < shown.length - 1 && nextZone !== zone
            return (
            <tr
              key={r.team.id ?? r.team.name}
              className={`border-b ${edge ? 'border-b-2 border-ink/30' : 'border-parchment'} ${
                zone === 'out' ? 'text-ink/60' : ''
              }`}
            >
              <td
                className={`py-2.5 tabular text-xs text-ink/40 ${
                  zone ? `border-l-[3px] pl-2 ${ZONE_BAR[zone]}` : ''
                }`}
              >
                {seed}
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
                      className="shrink-0 tabular text-[10px] uppercase text-gold"
                      title="ESPN clinch marker"
                    >
                      {r.clincher}
                    </span>
                  )}
                </Link>
              </td>
              <td className="py-2.5 pl-3 text-right tabular text-sm font-bold">{r.wins}</td>
              <td className="py-2.5 pl-3 text-right tabular text-sm">{r.losses}</td>
              <td className="py-2.5 pl-3 text-right tabular text-sm">{r.pct}</td>
              {!compact && (
                <>
                  <td className="py-2.5 pl-3 text-right tabular text-xs text-ink/60">
                    {r.gamesBehind ?? '—'}
                  </td>
                  <td
                    className={`py-2.5 pl-3 text-right tabular text-xs ${
                      String(r.diff).startsWith('-') ? 'text-ink/50' : 'text-crimson'
                    }`}
                  >
                    {r.diff ?? '—'}
                  </td>
                  <td className="py-2.5 pl-3 text-right tabular text-xs text-ink/50">
                    {r.streak ?? '—'}
                  </td>
                </>
              )}
            </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LEAGUES, getLeague } from '../lib/leagues.js'
import { useAsync } from '../lib/useAsync.js'
import { getLeaders, getStandings } from '../lib/api.js'
import StandingsPanel from '../components/StandingsPanel.jsx'
import { SectionHead, Loading, Empty, Eyebrow } from '../components/Primitives.jsx'
import { shortName } from '../lib/format.js'
import { playerHref } from '../lib/players.js'

const CATEGORIES = [
  { key: 'avgPoints', label: 'PPG', title: 'Points per game' },
  { key: 'avgRebounds', label: 'RPG', title: 'Rebounds per game' },
  { key: 'avgAssists', label: 'APG', title: 'Assists per game' },
  { key: 'avgSteals', label: 'STL', title: 'Steals per game' },
  { key: 'avgBlocks', label: 'BLK', title: 'Blocks per game' },
]

function LeadersTable({ rows, label, leagueKey }) {
  if (!rows?.length) return <Empty title="Leaders not published for this league yet." />
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse">
        <thead>
          <tr className="border-b border-ink">
            <th className="eyebrow w-10 py-2 text-left text-ink/50">#</th>
            <th className="eyebrow py-2 text-left text-ink/50">Player</th>
            <th className="eyebrow py-2 text-left text-ink/50">Team</th>
            <th className="eyebrow py-2 text-right text-ink/50">{label}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={`${p.name}-${i}`} className="border-b border-parchment">
              <td className="py-2.5 font-mono text-xs text-ink/40">{i + 1}</td>
              <td className="py-2.5">
                <div className="flex items-center gap-2.5">
                  {p.headshot ? (
                    <img
                      src={p.headshot}
                      alt=""
                      loading="lazy"
                      className="h-8 w-8 rounded-full bg-parchment object-cover"
                    />
                  ) : (
                    <span className="h-8 w-8 rounded-full bg-parchment" />
                  )}
                  {playerHref(leagueKey, p.playerId) ? (
                    <Link
                      to={playerHref(leagueKey, p.playerId)}
                      className="text-sm font-medium hover:text-crimson"
                    >
                      {i === 0 && <span className="mr-1 text-gold">★</span>}
                      {shortName(p.name)}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium">
                      {i === 0 && <span className="mr-1 text-gold">★</span>}
                      {shortName(p.name)}
                    </span>
                  )}
                </div>
              </td>
              <td className="py-2.5">
                {p.teamId ? (
                  <Link
                    to={`/team/${leagueKey}/${p.teamId}`}
                    className="eyebrow text-ink/60 hover:text-crimson"
                  >
                    {p.team || '—'}
                  </Link>
                ) : (
                  <span className="eyebrow text-ink/60">{p.team || '—'}</span>
                )}
              </td>
              <td className="py-2.5 text-right font-mono text-sm font-bold">{p.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Stats() {
  const [leagueKey, setLeagueKey] = useState('NBA')
  const [cat, setCat] = useState('avgPoints')
  const league = getLeague(leagueKey)

  const { data: leaders, loading } = useAsync(() => getLeaders(leagueKey), [leagueKey], null)
  const { data: standings } = useAsync(() => getStandings(leagueKey), [leagueKey], null)

  const activeCat = CATEGORIES.find((c) => c.key === cat) || CATEGORIES[0]
  const rows = leaders?.categories?.[cat] || []

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 md:px-8">
      <Eyebrow className="text-crimson">{league?.region} · The Ledger</Eyebrow>
      <h1 className="mt-3 text-6xl md:text-7xl">{league?.name} Stats</h1>
      <p className="mt-2 text-lg text-ink/60">{league?.fullName}</p>

      <div className="no-scrollbar mt-8 flex gap-2 overflow-x-auto border-b border-parchment pb-4">
        {LEAGUES.map((l) => (
          <button
            key={l.key}
            type="button"
            onClick={() => setLeagueKey(l.key)}
            className={`shrink-0 border px-4 py-2 transition-colors ${
              leagueKey === l.key
                ? 'border-ink bg-ink text-cream'
                : 'border-parchment hover:border-ink'
            }`}
          >
            <Eyebrow>{l.name}</Eyebrow>
          </button>
        ))}
      </div>

      <section className="mt-14">
        <SectionHead title="Player Leaders">
          <Eyebrow className="text-ink/40">
            {leaders?.label ||
              (leaders?.source === 'recent'
                ? 'From recent box scores'
                : leaders?.source === 'season'
                  ? 'Season averages'
                  : '')}
          </Eyebrow>
        </SectionHead>

        <div className="mb-6 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCat(c.key)}
              title={c.title}
              className={`border px-3 py-1.5 transition-colors ${
                cat === c.key ? 'border-crimson text-crimson' : 'border-parchment hover:border-ink'
              }`}
            >
              <Eyebrow>{c.label}</Eyebrow>
            </button>
          ))}
        </div>

        {loading ? (
          <Loading label="Tallying the ledger" />
        ) : (
          <LeadersTable rows={rows} label={activeCat.label} leagueKey={leagueKey} />
        )}
      </section>

      <section className="mt-20">
        <SectionHead title={`${league?.name} Standings`}>
          {standings?.seasonLabel && (
            <Eyebrow className="text-ink/40">{standings.seasonLabel}</Eyebrow>
          )}
        </SectionHead>
        {league && <StandingsPanel league={league} />}
      </section>
    </div>
  )
}

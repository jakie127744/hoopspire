import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LEAGUES, getLeague } from '../lib/leagues.js'
import { useAsync } from '../lib/useAsync.js'
import { getTeams } from '../lib/api.js'
import { TeamLogo, Loading, Empty, Eyebrow, SectionHead } from '../components/Primitives.jsx'

export default function Teams() {
  const [leagueKey, setLeagueKey] = useState('NBA')
  const league = getLeague(leagueKey)
  const { data: teams, loading } = useAsync(() => getTeams(leagueKey), [leagueKey], [])

  const list = [...(teams || [])].sort((a, b) => (a.name || '').localeCompare(b.name || ''))

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 md:px-8">
      <Eyebrow className="text-crimson">The Clubs</Eyebrow>
      <h1 className="mt-3 text-6xl md:text-7xl">Teams & Rosters</h1>
      <p className="mt-4 max-w-2xl text-lg text-ink/65">
        Every club in the ledger, with its most recent available roster.
      </p>

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

      <section className="mt-12">
        <SectionHead title={league?.fullName || 'Clubs'}>
          <span className="font-mono text-sm text-ink/40">{list.length}</span>
        </SectionHead>

        {loading ? (
          <Loading label="Assembling the clubs" />
        ) : list.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {list.map((t) => (
              <Link
                key={t.id}
                to={`/team/${leagueKey}/${t.id}`}
                className="card flex items-center gap-4 p-4 transition-shadow hover:shadow-[4px_4px_0_0_var(--color-parchment)]"
              >
                <TeamLogo team={t} size={44} />
                <div className="min-w-0">
                  <p className="truncate font-display text-xl leading-tight">{t.name}</p>
                  <p className="eyebrow mt-1 text-ink/45">
                    {t.abbr || ''}
                    {t.city ? ` · ${t.city}` : t.location ? ` · ${t.location}` : ''}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <Empty
            title="No clubs loaded for this league."
            hint={
              league?.source === 'snapshot'
                ? 'Run `npm run data` to populate this league from its official site.'
                : undefined
            }
          />
        )}
      </section>
    </div>
  )
}

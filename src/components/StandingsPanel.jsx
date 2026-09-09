import { useState } from 'react'
import StandingsTable from './StandingsTable.jsx'
import PlayoffPicture from './PlayoffPicture.jsx'
import { Eyebrow, Loading, Empty } from './Primitives.jsx'
import { useAsync } from '../lib/useAsync.js'
import { getStandings, getStandingsGrouped } from '../lib/api.js'
import { buildPlayoffPicture } from '../lib/playoffs.js'

/**
 * Standings with the views that actually answer questions people ask:
 * the whole league, the conference race (which is what seeding follows),
 * the division, and the bracket today's table would produce.
 *
 * Tabs only appear when the data supports them — a league with no conference
 * split shows the league table alone rather than three empty tabs.
 */
export default function StandingsPanel({ league, limit }) {
  const [view, setView] = useState('conference')

  const { data: flat, loading: flatLoading } = useAsync(
    () => getStandings(league.key),
    [league.key],
    null
  )
  const { data: grouped, loading: groupLoading } = useAsync(
    () => getStandingsGrouped(league.key),
    [league.key],
    null
  )

  const conferences = grouped?.conferences || []
  const divisions = grouped?.divisions || []
  const picture = buildPlayoffPicture(league, conferences)

  const views = [
    conferences.length > 1 && { key: 'conference', label: 'Conference' },
    divisions.length > 1 && { key: 'division', label: 'Division' },
    { key: 'league', label: 'League' },
    picture && { key: 'playoffs', label: 'If playoffs started today' },
  ].filter(Boolean)

  const active = views.some((v) => v.key === view) ? view : views[0]?.key || 'league'
  const seasonLabel = grouped?.seasonLabel || flat?.seasonLabel || ''
  const loading = flatLoading || groupLoading

  if (loading) return <Loading label="Reading the table" />

  return (
    <div>
      {views.length > 1 && (
        <div className="no-scrollbar mb-6 flex gap-2 overflow-x-auto">
          {views.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={`shrink-0 border px-4 py-2 transition-colors ${
                active === v.key
                  ? 'border-ink bg-ink text-cream'
                  : 'border-parchment hover:border-ink'
              }`}
            >
              <Eyebrow>{v.label}</Eyebrow>
            </button>
          ))}
        </div>
      )}

      {active === 'playoffs' && (
        <PlayoffPicture picture={picture} leagueKey={league.key} seasonLabel={seasonLabel} />
      )}

      {active === 'conference' && (
        <div className="grid gap-10 xl:grid-cols-2">
          {conferences.map((c) => (
            <section key={c.name}>
              <h3 className="mb-3 font-display text-2xl">{c.name}</h3>
              <StandingsTable
                standings={{ rows: c.rows }}
                leagueKey={league.key}
                limit={limit}
                seedFrom="group"
              />
            </section>
          ))}
        </div>
      )}

      {active === 'division' && (
        <div className="grid gap-10 md:grid-cols-2 xl:grid-cols-3">
          {divisions.map((d) => (
            <section key={`${d.conference}-${d.name}`}>
              <h3 className="font-display text-2xl">{d.name}</h3>
              <Eyebrow className="text-ink/40">{d.conference}</Eyebrow>
              <div className="mt-3">
                <StandingsTable
                  standings={{ rows: d.rows }}
                  leagueKey={league.key}
                  compact
                />
              </div>
            </section>
          ))}
        </div>
      )}

      {active === 'league' &&
        (flat?.rows?.length ? (
          <StandingsTable standings={flat} leagueKey={league.key} limit={limit} />
        ) : (
          <Empty title="Standings not published yet." />
        ))}
    </div>
  )
}

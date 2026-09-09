import { useState } from 'react'
import { useAsync, hasLiveGame } from '../lib/useAsync.js'
import { getAllGames } from '../lib/api.js'
import { LEAGUES } from '../lib/leagues.js'
import RefreshNote from '../components/RefreshNote.jsx'
import ScoreCard from '../components/ScoreCard.jsx'
import { SectionHead, Loading, Empty, Eyebrow } from '../components/Primitives.jsx'

const FILTERS = [{ key: 'ALL', name: 'All' }, ...LEAGUES]

function Group({ title, count, games }) {
  return (
    <section className="pt-14 first:pt-0">
      <SectionHead title={title}>
        <span className="font-mono text-sm text-ink/40">{count}</span>
      </SectionHead>
      {games.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {games.map((g) => (
            <ScoreCard key={`${g.league}-${g.id}`} game={g} />
          ))}
        </div>
      ) : (
        <Empty title="None on the docket." />
      )}
    </section>
  )
}

export default function Scores() {
  const [filter, setFilter] = useState('ALL')
  const { data: games, loading, refreshedAt, refresh } = useAsync(() => getAllGames(), [], [], {
    refreshMs: 120_000,
    liveMs: 30_000,
    isLive: hasLiveGame,
  })

  const all = games || []
  const shown = filter === 'ALL' ? all : all.filter((g) => g.league === filter)

  const live = shown.filter((g) => g.status === 'live')
  const finals = shown.filter((g) => g.status === 'final')
  const scheduled = shown
    .filter((g) => g.status === 'scheduled')
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 md:px-8">
      <Eyebrow className="text-crimson">The Scoreboard</Eyebrow>
      <h1 className="mt-3 text-5xl md:text-6xl">The Scoreboard</h1>
      <p className="mt-4 max-w-2xl text-lg text-ink/65">
        Live whistles, final results and upcoming fixtures across every league in the ledger.
      </p>

      <RefreshNote refreshedAt={refreshedAt} onRefresh={refresh} live={hasLiveGame(games)} />

      <div className="no-scrollbar mt-8 flex gap-2 overflow-x-auto border-b border-parchment pb-4">
        {FILTERS.map((f) => {
          const key = f.key === 'ALL' ? 'ALL' : f.key
          const active = filter === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`shrink-0 border px-4 py-2 transition-colors ${
                active
                  ? 'border-ink bg-ink text-cream'
                  : 'border-parchment hover:border-ink'
              }`}
            >
              <Eyebrow>{f.name}</Eyebrow>
            </button>
          )
        })}
      </div>

      {loading ? (
        <Loading label="Reading the scoreboard" />
      ) : (
        <div className="mt-10">
          <Group title="Live Now" count={live.length} games={live} />
          <Group title="Final Results" count={finals.length} games={finals} />
          <Group title="Scheduled" count={scheduled.length} games={scheduled} />
        </div>
      )}
    </div>
  )
}

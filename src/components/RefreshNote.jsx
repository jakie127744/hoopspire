import { useEffect, useState } from 'react'
import { Eyebrow } from './Primitives.jsx'

/**
 * "Updated 40s ago" line with a manual refresh.
 *
 * Scores poll on their own — every 30 seconds while a game is in progress,
 * every 2 minutes otherwise, paused whenever the tab is in the background.
 * This makes that cadence visible so a stale-looking score can be trusted or
 * forced.
 */
export default function RefreshNote({ refreshedAt, onRefresh, live }) {
  const [, tick] = useState(0)

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 5000)
    return () => clearInterval(t)
  }, [])

  if (!refreshedAt) return null

  const secs = Math.max(0, Math.round((Date.now() - refreshedAt) / 1000))
  const ago = secs < 60 ? `${secs}s ago` : `${Math.round(secs / 60)}m ago`

  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      {live && (
        <span className="inline-flex items-center gap-1.5 bg-crimson px-2 py-0.5 text-paper">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-paper" />
          <Eyebrow className="font-bold">Live</Eyebrow>
        </span>
      )}
      <Eyebrow className="text-ink/40">
        Updated {ago} · auto every {live ? '30s' : '2m'}
      </Eyebrow>
      <button
        type="button"
        onClick={onRefresh}
        className="border border-parchment px-3 py-1 transition-colors hover:border-ink"
      >
        <Eyebrow>Refresh</Eyebrow>
      </button>
    </div>
  )
}

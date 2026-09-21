import { useEffect, useState } from 'react'
import { REACTIONS } from '../lib/reactions.js'
import { Eyebrow } from './Primitives.jsx'

/**
 * Reactions under an article: four buttons and their counts.
 *
 * The server stores counts and nothing that identifies a reader, so it cannot
 * know who has already reacted. That is remembered here instead, in this
 * browser's own storage, as { [slug]: reactionKey }. It never leaves the
 * device — the same terms as the consent record, and /privacy says so.
 *
 * Clicking your current reaction takes it back; clicking another moves it.
 * Either way it is one request that adds and removes together, so a count
 * never briefly includes a reader twice.
 *
 * If the endpoint cannot be reached — the Vite dev server has no /api, or the
 * Worker is down — this renders nothing. A row of buttons that silently does
 * nothing is worse than no row.
 */

const STORE = 'hoopspire.reactions.v1'

function readMine() {
  try {
    return JSON.parse(localStorage.getItem(STORE) || '{}') || {}
  } catch {
    return {}
  }
}

function writeMine(all) {
  try {
    localStorage.setItem(STORE, JSON.stringify(all))
  } catch {
    // Private mode or blocked storage: the reaction still counts, it just
    // won't be remembered as this reader's after a reload.
  }
}

export default function Reactions({ slug }) {
  const [counts, setCounts] = useState(null)
  const [mine, setMine] = useState(() => readMine()[slug] ?? null)
  const [pending, setPending] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setCounts(null)
    setUnavailable(false)
    setMine(readMine()[slug] ?? null)
    fetch(`/api/reactions/${encodeURIComponent(slug)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => !cancelled && setCounts(data.counts))
      .catch(() => !cancelled && setUnavailable(true))
    return () => {
      cancelled = true
    }
  }, [slug])

  if (unavailable || !counts) return null

  async function choose(key) {
    if (pending) return
    const add = mine === key ? null : key
    const remove = mine

    // Optimistic: the click shows at once, and is rolled back if it fails.
    const before = { counts, mine }
    const next = { ...counts }
    if (remove) next[remove] = Math.max((next[remove] || 0) - 1, 0)
    if (add) next[add] = (next[add] || 0) + 1
    setCounts(next)
    setMine(add)
    setPending(true)
    setError(null)

    try {
      const res = await fetch(`/api/reactions/${encodeURIComponent(slug)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ add, remove }),
      })
      if (!res.ok) throw new Error(res.status === 429 ? 'slow' : 'failed')
      const data = await res.json()
      setCounts(data.counts)
      const all = readMine()
      if (add) all[slug] = add
      else delete all[slug]
      writeMine(all)
    } catch (err) {
      setCounts(before.counts)
      setMine(before.mine)
      setError(
        err.message === 'slow'
          ? 'That was a lot of clicks — give it a minute.'
          : 'That reaction did not save. Try again in a moment.'
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <section aria-label="React to this article" className="mt-14 border-t border-parchment pt-6">
      <Eyebrow className="text-ink/45">Your take</Eyebrow>
      <div className="mt-3 flex flex-wrap gap-2">
        {REACTIONS.map((r) => {
          const active = mine === r.key
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => choose(r.key)}
              disabled={pending}
              aria-pressed={active}
              aria-label={`${r.label}, ${counts[r.key] ?? 0}`}
              className={`flex items-center gap-2 border px-3 py-2 transition-colors disabled:cursor-wait ${
                active
                  ? 'border-ink bg-ink text-cream'
                  : 'border-parchment bg-paper hover:border-ink'
              }`}
            >
              <span aria-hidden="true" className="text-base leading-none">
                {r.emoji}
              </span>
              <span className="text-sm">{r.label}</span>
              <span className={`font-mono text-xs ${active ? 'text-cream/70' : 'text-ink/45'}`}>
                {counts[r.key] ?? 0}
              </span>
            </button>
          )
        })}
      </div>
      {error && (
        <p role="status" className="mt-3 text-sm text-crimson">
          {error}
        </p>
      )}
    </section>
  )
}

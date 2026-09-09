import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * Run an async loader and track {data, loading, error}.
 *
 * Guards against setting state after unmount and against a slow earlier
 * request overwriting a newer one when `deps` change quickly (e.g. flicking
 * between league tabs).
 *
 * Options:
 *   refreshMs   how often to re-run the loader in the background. `0` (the
 *               default) means load once.
 *   liveMs      faster interval used while `isLive(data)` is true.
 *   isLive      predicate deciding whether the payload is "in progress".
 *
 * Background refreshes never flip `loading` back on, so the page updates in
 * place instead of flashing a spinner. Polling pauses while the tab is hidden
 * and fires immediately on return, so a backgrounded tab isn't hammering the
 * league feeds — and isn't showing a stale score when you come back to it.
 */
export function useAsync(loader, deps = [], initial = null, options = {}) {
  const { refreshMs = 0, liveMs = 30_000, isLive } = options

  const [state, setState] = useState({ data: initial, loading: true, error: null })
  const [refreshedAt, setRefreshedAt] = useState(null)

  const loaderRef = useRef(loader)
  loaderRef.current = loader
  const isLiveRef = useRef(isLive)
  isLiveRef.current = isLive

  const aliveRef = useRef(true)
  const runIdRef = useRef(0)

  const run = useCallback(async (background) => {
    const runId = ++runIdRef.current
    if (!background) setState((s) => ({ ...s, loading: true, error: null }))

    try {
      const data = await loaderRef.current()
      if (!aliveRef.current || runId !== runIdRef.current) return
      setState({ data, loading: false, error: null })
      setRefreshedAt(Date.now())
    } catch (error) {
      if (!aliveRef.current || runId !== runIdRef.current) return
      // A failed background refresh keeps the last good data on screen.
      setState((s) => (background ? { ...s, error } : { data: initial, loading: false, error }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    aliveRef.current = true
    run(false)
    return () => {
      aliveRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    if (!refreshMs) return

    const live = isLiveRef.current ? isLiveRef.current(state.data) : false
    const interval = live ? liveMs : refreshMs

    let timer = null
    const schedule = () => {
      clearTimeout(timer)
      if (document.hidden) return
      timer = setTimeout(async () => {
        await run(true)
        schedule()
      }, interval)
    }

    const onVisibility = () => {
      if (document.hidden) {
        clearTimeout(timer)
      } else {
        // Catch up straight away, then resume the cadence.
        run(true).then(schedule)
      }
    }

    schedule()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshMs, liveMs, state.data])

  return { ...state, refreshedAt, refresh: () => run(true) }
}

/** True when any game in the list is currently in progress. */
export const hasLiveGame = (games) =>
  Array.isArray(games) && games.some((g) => g?.status === 'live')

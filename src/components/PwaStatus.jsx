import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Eyebrow } from './Primitives.jsx'

/**
 * Offline banner and update prompt for the installed app.
 *
 * Offline: live scores are deliberately never cached (see vite.config.js),
 * so rather than let the scoreboard look merely quiet, the app says plainly
 * that it is offline and that anything shown is from before.
 *
 * Update: a new version waits for the reader to accept it. Reloading on its
 * own would throw someone out of the article they were in the middle of.
 */
function useOnline() {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  )
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  return online
}

export default function PwaStatus() {
  const online = useOnline()
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  return (
    <>
      {!online && (
        <div
          role="status"
          className="sticky top-0 z-[70] bg-crimson px-4 py-2 text-center text-cream"
        >
          <Eyebrow className="font-bold">You're offline</Eyebrow>
          <span className="ml-2 text-sm text-cream/85">
            Live scores need a connection — anything shown here is from before.
          </span>
        </div>
      )}

      {needRefresh && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-[65] flex -translate-x-1/2 items-center gap-4 border border-ink bg-paper px-5 py-3 shadow-[4px_4px_0_0_var(--color-parchment)]"
        >
          <span className="text-sm">A new version of Hoopspire is ready.</span>
          <button
            type="button"
            onClick={() => updateServiceWorker(true)}
            className="border border-ink bg-ink px-3 py-1.5 text-cream transition-colors hover:border-crimson hover:bg-crimson"
          >
            <Eyebrow>Reload</Eyebrow>
          </button>
          <button
            type="button"
            onClick={() => setNeedRefresh(false)}
            className="text-ink/50 hover:text-ink"
            aria-label="Dismiss"
          >
            <Eyebrow>Later</Eyebrow>
          </button>
        </div>
      )}
    </>
  )
}

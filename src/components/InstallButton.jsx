import { useEffect, useState } from 'react'
import { Eyebrow } from './Primitives.jsx'

/**
 * "Install the app".
 *
 * Android and desktop Chrome/Edge fire `beforeinstallprompt`, which lets us
 * offer a real one-tap install. iOS Safari has no such API at all — Apple only
 * allows installing through the Share sheet — so on iPhone and iPad this shows
 * the two-step instruction instead of a button that could never work.
 *
 * Renders nothing once the app is already installed, and nothing in browsers
 * that support neither route.
 */

const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)

const isIOS = () => {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  // iPadOS 13+ reports itself as a Mac; touch support gives it away.
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

export default function InstallButton({ className = '', tone = 'dark' }) {
  const [deferred, setDeferred] = useState(null)
  const [installed, setInstalled] = useState(isStandalone)
  const [showIOSHelp, setShowIOSHelp] = useState(false)

  useEffect(() => {
    const onPrompt = (e) => {
      // Keep the browser's mini-infobar from appearing; we offer our own.
      e.preventDefault()
      setDeferred(e)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed) return null

  const ios = isIOS()
  if (!deferred && !ios) return null

  const btn =
    tone === 'light'
      ? 'border border-cream/40 px-4 py-2 text-cream transition-colors hover:bg-cream hover:text-ink'
      : 'border border-ink px-4 py-2 transition-colors hover:bg-ink hover:text-cream'

  if (deferred) {
    return (
      <button
        type="button"
        className={`${btn} ${className}`}
        onClick={async () => {
          deferred.prompt()
          await deferred.userChoice.catch(() => null)
          // The prompt can only be used once, whatever the reader chose.
          setDeferred(null)
        }}
      >
        <Eyebrow>Install the app</Eyebrow>
      </button>
    )
  }

  // iOS: instructions, since Safari offers no install API to call.
  return (
    <div className={className}>
      <button type="button" className={btn} onClick={() => setShowIOSHelp((v) => !v)}>
        <Eyebrow>Add to Home Screen</Eyebrow>
      </button>
      {showIOSHelp && (
        <p className={`mt-3 max-w-xs text-sm ${tone === 'light' ? 'text-cream/70' : 'text-ink/70'}`}>
          In Safari, tap <strong>Share</strong> <span aria-hidden="true">(□↑)</span>, then{' '}
          <strong>Add to Home Screen</strong>. Hoopspire opens full-screen, like an app.
        </p>
      )}
    </div>
  )
}

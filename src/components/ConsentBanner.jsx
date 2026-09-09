import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CATEGORIES, useConsent, setConsent, acceptAll, rejectAll } from '../lib/consent.js'
import { Eyebrow } from './Primitives.jsx'

/**
 * Consent banner.
 *
 * Shown until the reader makes a choice. "Reject" is given the same visual
 * weight as "Accept" — burying it is exactly what regulators penalise, and
 * Google's own policies require the choices be equally easy.
 */
export default function ConsentBanner() {
  const { decided, choices } = useConsent()
  const [managing, setManaging] = useState(false)
  const [draft, setDraft] = useState(choices)

  const openManage = () => {
    setDraft(choices)
    setManaging(true)
  }

  // The footer's "Cookie settings" link reopens this dialog after a decision
  // has already been made — required, since consent must be withdrawable as
  // easily as it was given.
  useEffect(() => {
    const open = () => {
      setDraft(choices)
      setManaging(true)
    }
    window.addEventListener('hoopspire:open-consent', open)
    return () => window.removeEventListener('hoopspire:open-consent', open)
  }, [choices])

  if (decided && !managing) return null

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie preferences"
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-parchment bg-paper shadow-[0_-6px_24px_rgba(26,26,26,0.08)]"
    >
      <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">
        {!managing ? (
          <div className="flex flex-col gap-5 md:flex-row md:items-center">
            <div className="flex-1">
              <Eyebrow className="text-crimson">Your choice</Eyebrow>
              <h2 className="mt-2 font-display text-2xl leading-tight">
                We ask before setting any cookie.
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-ink/65">
                Scores, standings and rosters work with no cookies at all. We only need your
                permission for optional analytics and advertising. See our{' '}
                <Link to="/privacy" className="text-crimson underline">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>

            <div className="flex flex-wrap gap-2 md:shrink-0">
              <button
                type="button"
                onClick={rejectAll}
                className="border border-ink px-5 py-2.5 transition-colors hover:bg-ink hover:text-cream"
              >
                <Eyebrow>Reject all</Eyebrow>
              </button>
              <button
                type="button"
                onClick={acceptAll}
                className="border border-ink bg-ink px-5 py-2.5 text-cream transition-colors hover:bg-crimson hover:border-crimson"
              >
                <Eyebrow>Accept all</Eyebrow>
              </button>
              <button
                type="button"
                onClick={openManage}
                className="border border-parchment px-5 py-2.5 transition-colors hover:border-ink"
              >
                <Eyebrow>Manage</Eyebrow>
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-display text-2xl">Cookie preferences</h2>
              <Eyebrow className="text-ink/40">Necessary only, by default</Eyebrow>
            </div>

            <div className="mt-5 divide-y divide-parchment border-y border-parchment">
              <div className="flex items-start gap-4 py-4">
                <span className="mt-1 shrink-0 border border-parchment bg-cream px-2 py-0.5">
                  <Eyebrow className="text-ink/45">Always on</Eyebrow>
                </span>
                <div>
                  <p className="font-medium">Strictly necessary</p>
                  <p className="mt-1 text-sm text-ink/60">
                    Only your consent choice itself is stored, in your own browser. No tracking,
                    and it never leaves your device.
                  </p>
                </div>
              </div>

              {CATEGORIES.map((c) => (
                <label key={c.key} className="flex cursor-pointer items-start gap-4 py-4">
                  <input
                    type="checkbox"
                    checked={!!draft[c.key]}
                    onChange={(e) => setDraft((d) => ({ ...d, [c.key]: e.target.checked }))}
                    className="mt-1 h-4 w-4 shrink-0 accent-[#8A0000]"
                  />
                  <div>
                    <p className="font-medium">{c.label}</p>
                    <p className="mt-1 text-sm text-ink/60">{c.description}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setConsent(draft)
                  setManaging(false)
                }}
                className="border border-ink bg-ink px-5 py-2.5 text-cream transition-colors hover:border-crimson hover:bg-crimson"
              >
                <Eyebrow>Save preferences</Eyebrow>
              </button>
              <button
                type="button"
                onClick={() => {
                  rejectAll()
                  setManaging(false)
                }}
                className="border border-ink px-5 py-2.5 transition-colors hover:bg-ink hover:text-cream"
              >
                <Eyebrow>Reject all</Eyebrow>
              </button>
              {decided && (
                <button
                  type="button"
                  onClick={() => setManaging(false)}
                  className="border border-parchment px-5 py-2.5 transition-colors hover:border-ink"
                >
                  <Eyebrow>Cancel</Eyebrow>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** Footer link that reopens the preferences dialog. */
export function CookieSettingsLink({ className = '' }) {
  const { decided } = useConsent()
  if (!decided) return null
  return (
    <button
      type="button"
      onClick={() => {
        // Re-opening is driven by clearing the decision flag in the UI layer;
        // simplest reliable route is a full remount via a custom event.
        window.dispatchEvent(new CustomEvent('hoopspire:open-consent'))
      }}
      className={className}
    >
      Cookie settings
    </button>
  )
}

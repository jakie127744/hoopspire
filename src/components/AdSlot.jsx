import { useEffect, useRef, useState } from 'react'
import { SITE } from '../lib/site.js'
import { useConsent } from '../lib/consent.js'
import { Eyebrow } from './Primitives.jsx'

/**
 * A consent-gated advertising slot.
 *
 * Deliberately network-agnostic: AdSense is only one option, and several
 * alternatives (Ezoic, Media.net, Raptive, Mediavine, PropellerAds) have
 * different traffic thresholds and content rules. Point `SITE.adNetwork` at
 * whichever you use.
 *
 * Two hard rules this component enforces:
 *   1. No ad script loads until the reader has consented to `advertising`.
 *      Loading one first is the single most common way sites break GDPR — and
 *      Google's EEA policy — without realising it.
 *   2. Nothing renders at all until a network is configured, so the site never
 *      ships empty ad frames while you are still applying for a network.
 *
 * The slot reserves its height up front, which keeps ads from shoving content
 * down as they load (Cumulative Layout Shift), a thing both readers and
 * Core Web Vitals punish.
 */

let scriptPromise = null

/** Load the network's script once, and only after consent. */
function loadNetworkScript(network, publisherId) {
  if (scriptPromise) return scriptPromise

  const src = {
    adsense: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisherId}`,
    medianet: 'https://contextual.media.net/dmedianet.js',
    ezoic: 'https://the.gatekeeperconsent.com/cmp.min.js',
  }[network]

  if (!src) return Promise.reject(new Error(`Unknown ad network: ${network}`))

  scriptPromise = new Promise((resolve, reject) => {
    const el = document.createElement('script')
    el.src = src
    el.async = true
    el.crossOrigin = 'anonymous'
    el.onload = resolve
    el.onerror = () => reject(new Error(`Failed to load ${network}`))
    document.head.appendChild(el)
  })

  return scriptPromise
}

export default function AdSlot({ slotId, format = 'auto', height = 280, className = '' }) {
  const { allows } = useConsent()
  const consented = allows('advertising')
  const ref = useRef(null)
  const pushed = useRef(false)
  const [failed, setFailed] = useState(false)

  const network = SITE.adNetwork
  const publisherId = SITE.adsensePublisherId
  const configured = !!network && !!publisherId

  useEffect(() => {
    if (!configured || !consented || pushed.current) return

    let cancelled = false
    loadNetworkScript(network, publisherId)
      .then(() => {
        if (cancelled || pushed.current) return
        pushed.current = true
        if (network === 'adsense') {
          // eslint-disable-next-line no-undef
          ;(window.adsbygoogle = window.adsbygoogle || []).push({})
        }
      })
      .catch(() => !cancelled && setFailed(true))

    return () => {
      cancelled = true
    }
  }, [configured, consented, network, publisherId])

  // Not configured yet — render nothing rather than an empty box.
  if (!configured) return null

  if (!consented) {
    return (
      <div
        className={`flex items-center justify-center border border-dashed border-parchment px-6 ${className}`}
        style={{ minHeight: height }}
      >
        <p className="max-w-sm text-center text-sm text-ink/45">
          Ads are turned off because you declined advertising cookies. You can change that in{' '}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('hoopspire:open-consent'))}
            className="text-crimson underline"
          >
            cookie settings
          </button>
          .
        </p>
      </div>
    )
  }

  if (failed) return null

  return (
    <div className={className} style={{ minHeight: height }}>
      <Eyebrow className="mb-1 block text-ink/30">Advertisement</Eyebrow>
      {network === 'adsense' ? (
        <ins
          ref={ref}
          className="adsbygoogle block"
          style={{ display: 'block', minHeight: height }}
          data-ad-client={publisherId}
          data-ad-slot={slotId}
          data-ad-format={format}
          data-full-width-responsive="true"
        />
      ) : (
        <div ref={ref} id={slotId} style={{ minHeight: height }} />
      )}
    </div>
  )
}

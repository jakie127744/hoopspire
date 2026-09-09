import { useState } from 'react'
import { Link } from 'react-router-dom'
import { SITE } from '../lib/site.js'
import { Eyebrow } from './Primitives.jsx'

/**
 * Newsletter signup.
 *
 * The list is the one audience asset no platform can take away — unlike an ad
 * network's approval or a search ranking — which is why this sits at the end
 * of every article rather than only in the footer.
 *
 * Two things it will not do:
 *
 *   1. Render at all until a provider is configured. A signup box that quietly
 *      drops addresses is worse than no signup box.
 *   2. Submit without explicit consent. An email address is personal data;
 *      under GDPR the lawful basis here is consent, and consent has to be
 *      given, not assumed. The checkbox is unticked by default on purpose.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Where each provider expects the POST. */
function endpointFor({ provider, endpoint }) {
  switch (provider) {
    case 'kit':
      return `https://app.kit.com/forms/${endpoint}/subscriptions`
    case 'buttondown':
      return `https://buttondown.com/api/emails/embed-subscribe/${endpoint}`
    case 'custom':
      return endpoint
    default:
      return null
  }
}

export default function NewsletterSignup({ variant = 'block' }) {
  const cfg = SITE.newsletter || {}
  const action = endpointFor(cfg)

  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [state, setState] = useState({ status: 'idle', message: '' })

  // Not configured — render nothing rather than a form that goes nowhere.
  if (!action) return null

  const submitting = state.status === 'submitting'

  async function onSubmit(e) {
    // Providers other than Kit do not reliably allow a cross-origin read of
    // the response, so those submit natively and the browser navigates to the
    // provider's own confirmation page. Only Kit is intercepted.
    if (cfg.provider !== 'kit') {
      if (!EMAIL_RE.test(email) || !consent) {
        e.preventDefault()
        setState({
          status: 'error',
          message: !consent ? 'Please tick the consent box first.' : 'That email looks wrong.',
        })
      }
      return
    }

    e.preventDefault()

    if (!EMAIL_RE.test(email)) {
      return setState({ status: 'error', message: 'That email looks wrong.' })
    }
    if (!consent) {
      return setState({ status: 'error', message: 'Please tick the consent box first.' })
    }

    setState({ status: 'submitting', message: '' })
    try {
      const res = await fetch(action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email_address: email }),
      })
      if (!res.ok) throw new Error(`Signup failed (${res.status})`)
      setState({ status: 'done', message: 'Check your inbox to confirm.' })
      setEmail('')
      setConsent(false)
    } catch (err) {
      // Never claim success we cannot verify.
      setState({
        status: 'error',
        message: 'That did not go through. Try again, or email us instead.',
      })
    }
  }

  if (state.status === 'done') {
    return (
      <div className="border border-gold bg-paper p-6">
        <Eyebrow className="text-gold">You're on the list</Eyebrow>
        <p className="mt-2 text-ink/75">{state.message}</p>
      </div>
    )
  }

  const compact = variant === 'compact'

  return (
    <section
      className={
        compact ? '' : 'border border-parchment bg-paper p-6 md:p-8'
      }
      aria-labelledby="newsletter-heading"
    >
      <Eyebrow className="text-crimson">Newsletter</Eyebrow>
      <h2
        id="newsletter-heading"
        className={`mt-2 font-display leading-tight ${compact ? 'text-2xl' : 'text-3xl'}`}
      >
        {cfg.title}
      </h2>
      {cfg.pitch && <p className="mt-3 max-w-xl text-ink/70">{cfg.pitch}</p>}

      <form
        onSubmit={onSubmit}
        action={action}
        method="post"
        target={cfg.provider === 'kit' ? undefined : '_blank'}
        className="mt-5"
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="newsletter-email" className="sr-only">
            Email address
          </label>
          <input
            id="newsletter-email"
            type="email"
            name="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (state.status === 'error') setState({ status: 'idle', message: '' })
            }}
            placeholder="you@example.com"
            className="flex-1 border border-parchment bg-cream px-4 py-3 text-ink outline-gold focus:outline focus:outline-2"
          />
          <button
            type="submit"
            disabled={submitting}
            className="border border-ink bg-ink px-6 py-3 text-cream transition-colors hover:border-crimson hover:bg-crimson disabled:opacity-50"
          >
            <Eyebrow>{submitting ? 'Sending…' : 'Subscribe'}</Eyebrow>
          </button>
        </div>

        <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-sm text-ink/65">
          <input
            type="checkbox"
            name="consent"
            checked={consent}
            onChange={(e) => {
              setConsent(e.target.checked)
              if (state.status === 'error') setState({ status: 'idle', message: '' })
            }}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#8A0000]"
          />
          <span>
            Email me the newsletter. I can unsubscribe from any issue, and my address will not
            be sold or shared — see the{' '}
            <Link to="/privacy" className="text-crimson underline">
              Privacy Policy
            </Link>
            .
          </span>
        </label>

        {state.status === 'error' && (
          <p role="alert" className="mt-3 text-sm text-crimson">
            {state.message}
          </p>
        )}
      </form>
    </section>
  )
}

import { SITE, isTodo, orWarn } from '../lib/site.js'
import { Eyebrow } from './Primitives.jsx'
import { formatDate } from '../lib/format.js'

/** Shared chrome for the legal pages, so they read as one document family. */
export function LegalPage({ kicker, title, intro, children }) {
  const unfilled = Object.entries(SITE).filter(([, v]) => isTodo(v))

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 md:px-8">
      <Eyebrow className="text-crimson">{kicker}</Eyebrow>
      <h1 className="mt-3 text-5xl md:text-6xl">{title}</h1>
      <p className="eyebrow mt-4 text-ink/40">
        Last updated {formatDate(SITE.lastUpdated, { month: 'long' })}
      </p>
      {intro && <p className="mt-8 text-lg leading-relaxed text-ink/70">{intro}</p>}

      {unfilled.length > 0 && (
        <div className="mt-8 border-l-2 border-crimson bg-paper px-5 py-4">
          <Eyebrow className="text-crimson">Not ready to publish</Eyebrow>
          <p className="mt-2 text-sm text-ink/70">
            {unfilled.length} placeholder{unfilled.length > 1 ? 's are' : ' is'} still unfilled in{' '}
            <code className="font-mono text-xs">src/lib/site.js</code> —{' '}
            {unfilled.map(([k]) => k).join(', ')}. This notice disappears once they are set, and
            only you see it here because it is rendered from the config, not hard-coded.
          </p>
        </div>
      )}

      <div className="mt-10 space-y-10">{children}</div>

      <p className="mt-16 border-t border-parchment pt-6 text-sm text-ink/45">
        These documents are a starting point drafted for a sports data and news-aggregation site.
        They are not legal advice — have a lawyer review them before you rely on them.
      </p>
    </div>
  )
}

export function Section({ title, children }) {
  return (
    <section>
      <h2 className="border-b border-parchment pb-2 font-display text-2xl">{title}</h2>
      <div className="mt-4 space-y-4 text-ink/75 [&_a]:text-crimson [&_a]:underline [&_li]:mb-2 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </section>
  )
}

/** Renders a config value, flagging it visibly when still a placeholder. */
export function Value({ of }) {
  const v = SITE[of]
  return <span className={isTodo(v) ? 'bg-crimson/10 text-crimson' : ''}>{orWarn(v)}</span>
}

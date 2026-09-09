import { initials } from '../lib/format.js'

/** Serif section heading with the hairline rule, as used across the design. */
export function SectionHead({ title, action, children }) {
  return (
    <div className="section-head">
      <h2 className="text-3xl md:text-4xl">{title}</h2>
      <div className="ml-auto flex items-center gap-4">
        {children}
        {action}
      </div>
    </div>
  )
}

export function Eyebrow({ children, className = '' }) {
  return <span className={`eyebrow ${className}`}>{children}</span>
}

/** League chip — crimson for the league name, muted for the region. */
export function LeagueTag({ league, tag }) {
  return (
    <div className="flex items-center gap-2">
      <span className="eyebrow font-bold text-crimson">{league}</span>
      {tag && (
        <>
          <span className="text-parchment">·</span>
          <span className="eyebrow text-ink/50">{tag}</span>
        </>
      )}
    </div>
  )
}

/**
 * Team logo with a lettermark fallback — snapshot leagues don't always have a
 * usable crest URL, and we never want a broken image in the ledger.
 */
export function TeamLogo({ team, size = 40 }) {
  const src = team?.logo
  if (!src) {
    return (
      <div
        className="flex shrink-0 items-center justify-center border border-parchment bg-cream font-mono text-ink/60"
        style={{ width: size, height: size, fontSize: size * 0.32 }}
      >
        {initials(team?.abbr || team?.name)}
      </div>
    )
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      width={size}
      height={size}
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
      onError={(e) => {
        e.currentTarget.style.visibility = 'hidden'
      }}
    />
  )
}

export function Loading({ label = 'Loading the ledger' }) {
  return (
    <div className="flex items-center gap-3 py-16 text-ink/40">
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-crimson" />
      <Eyebrow>{label}…</Eyebrow>
    </div>
  )
}

export function Empty({ title = 'None on the docket.', hint }) {
  return (
    <div className="border border-dashed border-parchment px-6 py-12 text-center">
      <p className="font-display text-xl text-ink/50">{title}</p>
      {hint && <p className="mt-2 text-sm text-ink/40">{hint}</p>}
    </div>
  )
}

/** Live/final/scheduled pill. */
export function StatusPill({ game }) {
  if (game.status === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 bg-crimson px-2 py-0.5 text-paper">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-paper" />
        <span className="eyebrow font-bold">Live</span>
      </span>
    )
  }
  if (game.status === 'final') {
    return <span className="eyebrow text-ink/45">Final</span>
  }
  return <span className="eyebrow text-ink/45">{game.statusDetail || 'Scheduled'}</span>
}

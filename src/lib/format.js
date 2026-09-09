/**
 * Parse a value into a Date.
 *
 * A bare `YYYY-MM-DD` is parsed by JS as UTC midnight, which then renders as
 * the *previous* day for anyone west of Greenwich. Article frontmatter uses
 * date-only strings, so those are read as local calendar dates instead.
 */
function toDate(value) {
  if (value instanceof Date) return value
  const m = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return new Date(value)
}

export function formatDate(value, opts = {}) {
  if (!value) return ''
  const d = toDate(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...opts,
  })
}

export function formatTime(value) {
  if (!value) return ''
  const d = toDate(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/** "3h ago" / "2d ago" — used on wire copy where recency is the point. */
export function relativeTime(value) {
  if (!value) return ''
  const d = toDate(value)
  if (Number.isNaN(d.getTime())) return ''
  const mins = Math.round((Date.now() - d.getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(value)
}

/** Shorten "Jayson Tatum" to "J. Tatum" for the leaders table. */
export function shortName(name) {
  if (!name) return ''
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return name
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`
}

export function initials(name) {
  if (!name) return '??'
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

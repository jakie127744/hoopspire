/**
 * Never let a run replace real data with nothing.
 *
 * The scrapers already refuse to write when a whole league fails. The subtler
 * failure is partial: RealGM throttles a run, standings and stats come back
 * empty, and the league is written anyway — with its tables wiped. That
 * happened once in a manual run (CBA and NBB written with 0 players). On a
 * schedule nobody would be watching, so it is guarded here instead.
 *
 * Rule: a section that comes back empty keeps the previous run's value, and
 * the snapshot records which sections are carried over and since when, so the
 * data is never presented as fresher than it is.
 */

const isEmpty = (key, value) => {
  if (value == null) return true
  if (key === 'standings') return !value.rows?.length
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value).length === 0
  return false
}

/**
 * Sections built from RealGM together. If its standings vanish, the club
 * list, rosters and stats in the same run were built without it as well —
 * clubs fall back to results-table labels and players cannot attach — so
 * they are restored as a unit rather than mixed with a degraded club list.
 */
const REALGM_COUPLED = ['teams', 'rosters', 'playerStats', 'leaders', 'standings']

const SECTIONS = ['teams', 'rosters', 'playerStats', 'standings', 'games', 'news', 'leaders']

export function keepPrevious(prev, next, sections = SECTIONS) {
  if (!prev) return { data: next, kept: [] }

  const now = next.fetchedAt || new Date().toISOString()
  const prevUpdated = prev.sectionsUpdatedAt || {}
  const updated = {}
  const kept = new Set()

  const restore = (key) => {
    next[key] = prev[key]
    kept.add(key)
    updated[key] = prevUpdated[key] || prev.fetchedAt || null
  }

  if (
    sections.includes('standings') &&
    !isEmpty('standings', prev.standings) &&
    isEmpty('standings', next.standings)
  ) {
    for (const key of REALGM_COUPLED) if (prev[key] !== undefined) restore(key)
  }

  for (const key of sections) {
    if (kept.has(key)) continue
    if (isEmpty(key, next[key]) && !isEmpty(key, prev[key])) restore(key)
    else updated[key] = now
  }

  next.sectionsUpdatedAt = updated
  if (kept.size) {
    const list = [...kept]
    next.carriedOver = list
    next.notes = [
      ...(next.notes || []),
      `Kept the previous run's ${list.join(', ')} — the source returned nothing this time.`,
    ]
  } else {
    delete next.carriedOver
  }

  return { data: next, kept: [...kept] }
}

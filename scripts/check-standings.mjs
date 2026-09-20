/**
 * Smoke check for the official-standings scrapers.
 *
 * These read three leagues' own websites, so they break without warning when
 * a site is redesigned — and they break silently, because every one of them
 * is written to degrade to empty rows rather than throw. Empty rows are the
 * correct answer for a season that has not started and a bug the rest of the
 * time, and nothing downstream can tell the two apart.
 *
 * So run this by hand before trusting a refresh:
 *
 *   npm run check:standings
 *
 * Expect real records for B.League and NBB in season, and a note rather than
 * a table of zeros for anything that has not tipped off yet.
 */
import { bleagueStandings, nbbStandings, cbaStandings } from './official-standings.mjs'

const show = (label, { seasonLabel, rows, conferences, note }) => {
  const summary = [
    seasonLabel || '—',
    `${rows.length} rows`,
    conferences ? conferences.map((c) => `${c.name}(${c.rows.length})`).join(', ') : null,
    note || null,
  ]
    .filter(Boolean)
    .join(' | ')
  console.log(`${label.padEnd(9)} ${summary}`)
  for (const r of rows.slice(0, 3)) {
    console.log(
      `   ${String(r.seed).padStart(2)}  ${String(r.team.name).padEnd(24)} ${r.wins}-${r.losses}`
    )
  }
}

for (const [label, fn] of [
  ['B.League', bleagueStandings],
  ['NBB', nbbStandings],
  ['CBA', cbaStandings],
]) {
  try {
    show(label, await fn())
  } catch (err) {
    console.error(`${label.padEnd(9)} FAILED — ${err.message}`)
    process.exitCode = 1
  }
}

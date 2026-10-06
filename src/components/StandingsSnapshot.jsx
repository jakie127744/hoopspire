import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAsync } from '../lib/useAsync.js'
import { getStandings } from '../lib/api.js'
import { LEAGUES } from '../lib/leagues.js'
import StandingsTable from './StandingsTable.jsx'

const FEATURED = 4
const RECENT_DAYS = 14
const AVAILABLE_DAYS = 90
const STORAGE_KEY = 'hoopspire.standings'

/** Weeks since the epoch, turning over on Monday (1 Jan 1970 was a Thursday). */
const weekNumber = (now = Date.now()) => Math.floor((now / 86_400_000 + 3) / 7)

/** Leagues with a result in the last `days` days, in ledger order. */
export function inSeasonLeagues(games, days = RECENT_DAYS, now = Date.now()) {
  const cutoff = now - days * 86_400_000
  const recent = new Set(
    games
      .filter((g) => g.status === 'final' && new Date(g.date).getTime() >= cutoff)
      .map((g) => g.league)
  )
  return LEAGUES.filter((l) => recent.has(l.key))
}

const played = (rows) => rows.some((r) => (r.wins ?? 0) + (r.losses ?? 0) > 0)

/**
 * Every league with a current table worth showing.
 *
 * A league qualifies with a result in the last three months — the PBA
 * breaks for weeks mid-season and its table is still this season's — and a
 * table that has games in it and is not ESPN's fallback to last season. That
 * last test is what keeps the NBA out in October: its regular-season table is
 * 0-0 until opening night, so the adapter hands back 2025-26, flagged.
 *
 * Without the recency test a league between seasons would offer last
 * season's final table as if it were current — the CBA's snapshot still
 * carries 2025-26 until its new season tips.
 */
function useAvailableTables(games) {
  const candidates = inSeasonLeagues(games, AVAILABLE_DAYS)
  const keys = candidates.map((l) => l.key).join(',')
  const { data } = useAsync(
    async () => {
      const results = await Promise.all(
        candidates.map(async (l) => {
          const s = await getStandings(l.key)
          const rows = s?.rows || []
          return rows.length && played(rows) && !s.isPreviousSeason ? { league: l, standings: s } : null
        })
      )
      return results.filter(Boolean)
    },
    [keys],
    []
  )
  return data || []
}

/**
 * This week's four: the leagues with a result in the last fortnight,
 * rotated by week so the default front page covers the whole of what is
 * being played over a fortnight or two instead of the same four every visit.
 */
function weeklyDefault(available, games) {
  const recent = new Set(inSeasonLeagues(games).map((l) => l.key))
  const pool = available.filter((t) => recent.has(t.league.key))
  if (!pool.length) return available.slice(0, FEATURED).map((t) => t.league.key)
  const start = weekNumber() % pool.length
  return [...pool.slice(start), ...pool.slice(0, start)].slice(0, FEATURED).map((t) => t.league.key)
}

/**
 * The reader's own pick of leagues, kept in this browser only. Storage can
 * be missing or throw (private windows, blocked site data), and then the
 * picker simply forgets between visits.
 */
function readSaved() {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return Array.isArray(v) ? v : null
  } catch {
    return null
  }
}
function writeSaved(keys) {
  try {
    if (keys) localStorage.setItem(STORAGE_KEY, JSON.stringify(keys))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* not remembered; still works for this visit */
  }
}

/**
 * Standings for the front page.
 *
 * Returns the tables to show and, when the reader can choose, what the
 * picker needs. With a league picked in the page's switcher, it is that
 * league's table alone and there is nothing to choose.
 */
export function useStandingsTables(games, league) {
  const available = useAvailableTables(games)
  const [saved, setSaved] = useState(readSaved)

  if (league) {
    return { tables: available.filter((t) => t.league.key === league.key), picker: null }
  }

  const defaults = weeklyDefault(available, games)
  // A saved league that has since gone out of season just drops out.
  // An empty pick is a pick: the reader turned everything off on purpose.
  const custom = Array.isArray(saved)
  const chosen = custom ? saved.filter((k) => available.some((t) => t.league.key === k)) : defaults

  const save = (keys) => {
    writeSaved(keys)
    setSaved(keys)
  }
  const toggle = (key) => {
    const next = chosen.includes(key) ? chosen.filter((k) => k !== key) : [...chosen, key]
    // Ledger order, so the tables do not reshuffle as chips are tapped.
    save(LEAGUES.map((l) => l.key).filter((k) => next.includes(k)))
  }

  return {
    tables: available.filter((t) => chosen.includes(t.league.key)),
    picker:
      available.length > 1
        ? { leagues: available.map((t) => t.league), chosen, custom, toggle, reset: () => save(null) }
        : null,
  }
}

/** Chips for choosing which leagues' tables to show. */
export function StandingsPicker({ picker }) {
  const chip = (on) =>
    `eyebrow inline-flex min-h-11 shrink-0 snap-start items-center gap-1.5 border px-4 transition-colors ${
      on ? 'border-ink bg-ink text-cream' : 'border-parchment bg-paper text-ink/70 hover:border-ink hover:text-ink'
    }`
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-sm text-ink/60">
          {picker.custom ? 'Your leagues — kept in this browser.' : 'This week’s four. Tap a league to add or remove it.'}
        </p>
        {picker.custom && (
          <button
            type="button"
            onClick={picker.reset}
            className="eyebrow inline-flex min-h-11 items-center text-crimson hover:underline"
          >
            Reset to this week’s
          </button>
        )}
      </div>
      <div
        role="group"
        aria-label="Leagues to show standings for"
        className="no-scrollbar -mx-4 mt-2 flex snap-x gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0"
      >
        {picker.leagues.map((l) => {
          const on = picker.chosen.includes(l.key)
          return (
            <button
              key={l.key}
              type="button"
              aria-pressed={on}
              onClick={() => picker.toggle(l.key)}
              className={chip(on)}
            >
              {on && <span aria-hidden="true">✓</span>}
              {l.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * The tables: two across from tablet width, stacked on a phone, where a
 * table squeezed to fit a swipe row ended up scrolling inside its own card.
 */
export function StandingsGrid({ tables }) {
  if (!tables.length) {
    return <p className="text-base text-ink/60">Pick a league above to see its table.</p>
  }
  return (
    <div className={`grid gap-6 ${tables.length > 1 ? 'md:grid-cols-2 md:gap-8' : ''}`}>
      {tables.map(({ league: l, standings }) => (
        <div key={l.key} className="card p-4 sm:p-5">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <Link to={`/league/${l.slug}`} className="font-display text-2xl hover:text-crimson">
              {l.name}
            </Link>
            {standings.seasonLabel && <span className="eyebrow text-ink/45">{standings.seasonLabel}</span>}
          </div>
          <StandingsTable standings={standings} leagueKey={l.key} limit={5} compact />
        </div>
      ))}
    </div>
  )
}

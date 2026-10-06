import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getOriginals, DESKS } from '../lib/articles.js'
import { LEAGUES, getLeague } from '../lib/leagues.js'
import { formatDate } from '../lib/format.js'
import { playerHref } from '../lib/players.js'
import { LeagueTag, Eyebrow, TeamLogo } from '../components/Primitives.jsx'
import { DeskBadge } from '../components/ArticleCard.jsx'
import { useMeta } from '../lib/meta.js'

/** Markdown down to words, for matching and for the snippet under a result. */
const plain = (md) =>
  md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`|~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const fold = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

/** "2026-09" — the month a piece belongs to, from its date-only frontmatter. */
const monthOf = (published) => (published ? String(published).slice(0, 7) : '')
const monthLabel = (ym) => {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

/**
 * Built once per page load: every published piece with its searchable text
 * folded to plain lowercase, so "Dončić" matches "doncic".
 */
function useIndex() {
  return useMemo(
    () =>
      getOriginals().map((a) => {
        const body = plain(a.body)
        const league = getLeague(a.league)
        return {
          a,
          body,
          month: monthOf(a.published),
          title: fold(a.title),
          dek: fold(a.description),
          text: fold(body),
          meta: fold([league?.name, league?.fullName, a.league, a.tag, a.byline, a.deskName].filter(Boolean).join(' ')),
        }
      }),
    []
  )
}

/**
 * Rank by where the words land: a title hit outranks a dek hit outranks a
 * body hit. Every word has to appear somewhere, so adding a word narrows the
 * results the way people expect a search box to.
 */
function score(entry, terms) {
  let total = 0
  for (const t of terms) {
    const s =
      (entry.title.includes(t) ? 8 : 0) +
      (entry.meta.includes(t) ? 4 : 0) +
      (entry.dek.includes(t) ? 3 : 0) +
      (entry.text.includes(t) ? 1 : 0)
    if (!s) return 0
    total += s
  }
  return total
}

/** The sentence or so around the first hit in the body, so a result shows why it matched. */
function snippet(body, terms) {
  const folded = fold(body)
  let at = -1
  for (const t of terms) {
    const i = folded.indexOf(t)
    if (i >= 0 && (at < 0 || i < at)) at = i
  }
  if (at < 0) return ''
  const start = Math.max(0, at - 80)
  const end = Math.min(body.length, at + 160)
  return `${start > 0 ? '…' : ''}${body.slice(start, end).trim()}${end < body.length ? '…' : ''}`
}

/**
 * The search index (public/data/search-index.json, built by
 * scripts/build-search-index.mjs): every player and team with a page, about
 * 95 KB gzipped. Fetched the first time someone types, not on page load, so
 * browsing the archive costs nothing extra.
 */
let indexPromise = null
function loadIndex() {
  const unpack = (block, text) =>
    (block?.rows || []).map((r) => {
      const x = Object.fromEntries(block.fields.map((f, i) => [f, r[i]]))
      return { ...x, folded: fold(text(x)) }
    })
  indexPromise ??= fetch('/data/search-index.json')
    .then((r) => (r.ok ? r.json() : {}))
    .then((data) => ({
      players: unpack(data.players, (p) => `${p.name} ${p.nameLocal || ''}`),
      // A team's abbreviation is searchable too: people type "LAL" and "OKC".
      teams: unpack(data.teams, (t) => `${t.name} ${t.nameLocal || ''} ${t.abbr || ''}`),
    }))
    .catch(() => {
      indexPromise = null
      return { players: [], teams: [] }
    })
  return indexPromise
}

function useSearchIndex(active) {
  const [index, setIndex] = useState(null)
  useEffect(() => {
    if (!active || index) return
    let alive = true
    loadIndex().then((data) => alive && setIndex(data))
    return () => {
      alive = false
    }
  }, [active, index])
  return index
}

const PLAYER_LIMIT = 12
const TEAM_LIMIT = 6

/**
 * Rows whose text contains every word typed. One that starts with the query
 * ranks first, then one where every word starts a word — so "james" puts
 * James Harden above Jameson Smith, and "kings" puts the Kings above
 * Kingston.
 */
function matchRows(list, terms, leagueKey) {
  if (!list || !terms.length) return []
  const q = terms.join(' ')
  return list
    .filter((x) => (!leagueKey || x.league === leagueKey) && terms.every((t) => x.folded.includes(t)))
    .map((x) => ({
      x,
      rank: x.folded.startsWith(q) ? 0 : terms.every((t) => ` ${x.folded}`.includes(` ${t}`)) ? 1 : 2,
    }))
    .sort((a, b) => a.rank - b.rank || a.x.name.localeCompare(b.x.name))
    .map(({ x }) => x)
}

function ResultCard({ to, logo, title, local, sub, league }) {
  return (
    <Link
      to={to}
      className="card flex min-h-14 items-center gap-3 px-4 py-2.5 transition-shadow hover:shadow-[4px_4px_0_0_var(--color-parchment)]"
    >
      {logo}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">
          {title}
          {local && <span className="ml-2 text-sm text-ink/45">{local}</span>}
        </span>
        {sub && <span className="block truncate text-sm text-ink/55">{sub}</span>}
      </span>
      <span className="eyebrow shrink-0 font-bold text-crimson">{league}</span>
    </Link>
  )
}

function Select({ label, value, onChange, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="eyebrow text-ink/50">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 border border-parchment bg-paper px-3 text-base focus:border-ink focus:outline-none"
      >
        {children}
      </select>
    </label>
  )
}

/**
 * Search and the archive, one page.
 *
 * With no query it is the archive: everything we have published, newest
 * first, grouped by month, narrowed by league, desk and month. Type a query
 * and the same filters apply to the matches. Every choice is in the URL, so
 * a search can be shared and the browser's Back button undoes a filter.
 *
 * It searches our own writing only — bundled at build time, so there is no
 * server, no index to keep in sync, and nothing to wait for.
 */
export default function Archive() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const leagueParam = params.get('league') || ''
  const deskParam = params.get('desk') || ''
  const monthParam = params.get('month') || ''
  const filtered = !!(q || leagueParam || deskParam || monthParam)

  useMeta({
    title: q ? `Search: ${q}` : 'Archive',
    description: 'Every piece Hoopspire has published, searchable and filterable by league, desk and month.',
    // The bare archive is a page worth indexing; every filtered or searched
    // variant of it is the same content in a different order.
    noindex: filtered,
  })

  const index = useIndex()
  const inputRef = useRef(null)
  // The header's search button lands here with ?focus=1, so the reader can
  // type straight away — including when they are already on this page.
  const wantsFocus = params.get('focus') === '1'
  useEffect(() => {
    if (wantsFocus) inputRef.current?.focus()
  }, [wantsFocus])

  const set = (key, value) => {
    const next = new URLSearchParams(params)
    next.delete('focus')
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: key === 'q', preventScrollReset: true })
  }

  // Filter options come from what exists, so no choice leads to nothing.
  const leagues = LEAGUES.filter((l) => index.some((e) => e.a.league === l.key))
  const months = [...new Set(index.map((e) => e.month).filter(Boolean))].sort().reverse()
  const desks = Object.values(DESKS).filter((d) => index.some((e) => e.a.desk === d.key))

  const terms = fold(q).split(/\s+/).filter(Boolean)
  const results = index
    .filter(
      (e) =>
        (!leagueParam || e.a.league === leagueParam) &&
        (!deskParam || e.a.desk === deskParam) &&
        (!monthParam || e.month === monthParam)
    )
    .map((e) => ({ ...e, score: terms.length ? score(e, terms) : 1 }))
    .filter((e) => e.score > 0)

  if (terms.length) results.sort((x, y) => y.score - x.score)

  // Leagues whose name matches the query, offered as a shortcut to their page.
  const leagueHits = terms.length
    ? LEAGUES.filter((l) => terms.every((t) => fold(`${l.name} ${l.fullName} ${l.key}`).includes(t)))
    : []

  // Player and team search need two letters — one letter matches half the index.
  const playerQuery = terms.join('').length >= 2
  const searchIndex = useSearchIndex(playerQuery)
  const playerHits = playerQuery ? matchRows(searchIndex?.players, terms, leagueParam) : []
  const teamHits = playerQuery ? matchRows(searchIndex?.teams, terms, leagueParam) : []

  // Grouped by month for browsing; ranked flat for a search.
  const groups = terms.length
    ? [{ key: 'results', items: results }]
    : months
        .map((m) => ({ key: m, label: monthLabel(m), items: results.filter((e) => e.month === m) }))
        .filter((g) => g.items.length)

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 md:px-8">
      <Eyebrow className="text-crimson">Search the ledger</Eyebrow>
      <h1 className="mt-3 text-5xl md:text-6xl">Archive</h1>
      <p className="mt-4 max-w-2xl text-lg text-ink/65">
        Every piece we have published — {index.length} so far — across all three desks, and
        every player and team with a page in the ledger.
      </p>

      <form role="search" onSubmit={(e) => e.preventDefault()} className="mt-8">
        <label htmlFor="archive-q" className="sr-only">
          Search stories, players and teams
        </label>
        <input
          id="archive-q"
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => set('q', e.target.value)}
          placeholder="Search players, teams, leagues…"
          autoComplete="off"
          className="min-h-12 w-full border border-ink bg-paper px-4 text-lg placeholder:text-ink/35 focus:outline-none focus:ring-2 focus:ring-crimson/30"
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Select label="League" value={leagueParam} onChange={(v) => set('league', v)}>
            <option value="">All leagues</option>
            {leagues.map((l) => (
              <option key={l.key} value={l.key}>
                {l.name}
              </option>
            ))}
          </Select>
          <Select label="Desk" value={deskParam} onChange={(v) => set('desk', v)}>
            <option value="">All desks</option>
            {desks.map((d) => (
              <option key={d.key} value={d.key}>
                {d.name}
              </option>
            ))}
          </Select>
          <Select label="Month" value={monthParam} onChange={(v) => set('month', v)}>
            <option value="">Any month</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </Select>
        </div>
      </form>

      <div className="mt-8 flex flex-wrap items-baseline gap-x-4 gap-y-2 border-b border-ink pb-3">
        <p className="font-mono text-sm text-ink/60" aria-live="polite">
          {results.length} {results.length === 1 ? 'piece' : 'pieces'}
          {q ? ` matching “${q}”` : ''}
        </p>
        {filtered && (
          <button
            type="button"
            onClick={() => setParams(new URLSearchParams(), { preventScrollReset: true })}
            className="eyebrow ml-auto inline-flex min-h-11 items-center text-crimson hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      {leagueHits.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {leagueHits.map((l) => (
            <Link
              key={l.key}
              to={`/league/${l.slug}`}
              className="inline-flex min-h-11 items-center gap-2 border border-parchment bg-paper px-4 hover:border-ink"
            >
              {l.logo && <img src={l.logo} alt="" className="h-6 w-6 object-contain" />}
              <span className="text-sm">{l.fullName}</span>
              <span className="eyebrow text-crimson">League page →</span>
            </Link>
          ))}
        </div>
      )}

      {teamHits.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-3xl">
            Teams <span className="font-mono text-sm text-ink/40">{teamHits.length}</span>
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {teamHits.slice(0, TEAM_LIMIT).map((t) => {
              const lg = getLeague(t.league)
              return (
                <li key={`${t.league}-${t.id}`}>
                  <ResultCard
                    to={`/team/${t.league}/${encodeURIComponent(t.id)}`}
                    logo={<TeamLogo team={t} size={28} />}
                    title={t.name}
                    local={t.nameLocal}
                    sub={lg?.fullName}
                    league={lg?.name || t.league}
                  />
                </li>
              )
            })}
          </ul>
          {teamHits.length > TEAM_LIMIT && (
            <p className="mt-3 text-sm text-ink/55">
              {teamHits.length - TEAM_LIMIT} more — add a word or pick a league to narrow it.
            </p>
          )}
        </section>
      )}

      {playerHits.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-3xl">
            Players <span className="font-mono text-sm text-ink/40">{playerHits.length}</span>
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {playerHits.slice(0, PLAYER_LIMIT).map((pl) => {
              const lg = getLeague(pl.league)
              return (
                <li key={`${pl.league}-${pl.id}`}>
                  <ResultCard
                    to={playerHref(pl.league, pl.id)}
                    logo={lg?.logo && <img src={lg.logo} alt="" className="h-7 w-7 shrink-0 object-contain" />}
                    title={pl.name}
                    local={pl.nameLocal}
                    sub={[pl.position, pl.team].filter(Boolean).join(' · ')}
                    league={lg?.name || pl.league}
                  />
                </li>
              )
            })}
          </ul>
          {playerHits.length > PLAYER_LIMIT && (
            <p className="mt-3 text-sm text-ink/55">
              {playerHits.length - PLAYER_LIMIT} more — add a surname or pick a league to narrow it.
            </p>
          )}
        </section>
      )}

      {results.length > 0 && (playerHits.length > 0 || teamHits.length > 0) && <h2 className="mt-10 text-3xl">Stories</h2>}

      {results.length === 0 ? (
        <p className="mt-10 text-base text-ink/60">
          {playerHits.length || teamHits.length ? 'No stories mention that yet. ' : 'Nothing we have written matches that. '}
          Try fewer words, or{' '}
          <Link to="/scores" className="text-crimson hover:underline">
            the scoreboard
          </Link>{' '}
          for games and teams.
        </p>
      ) : (
        groups.map((g) => (
          <section key={g.key} className="mt-10">
            {g.label && <h2 className="mb-2 text-3xl">{g.label}</h2>}
            <ol className="divide-y divide-parchment">
              {g.items.map(({ a, body }) => {
                const hit = terms.length ? snippet(body, terms) : ''
                return (
                  <li key={a.id}>
                    <Link to={a.href} className="group block py-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <LeagueTag league={a.league || 'Hoopspire'} tag={a.tag} />
                        <DeskBadge article={a} />
                        <time dateTime={a.published || undefined} className="eyebrow ml-auto text-ink/45">
                          {formatDate(a.published)}
                        </time>
                      </div>
                      <h3 className="mt-2 font-display text-2xl leading-snug">
                        <span className="link-underline">{a.title}</span>
                      </h3>
                      {a.description && <p className="mt-2 text-base text-ink/65">{a.description}</p>}
                      {hit && <p className="mt-2 text-sm italic text-ink/50">{hit}</p>}
                    </Link>
                  </li>
                )
              })}
            </ol>
          </section>
        ))
      )}
    </div>
  )
}

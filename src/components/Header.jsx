import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LEAGUES, leaguesByGroup, getLeague } from '../lib/leagues.js'
import { getOriginal } from '../lib/articles.js'
import InstallButton from './InstallButton.jsx'
import { Wordmark } from './Primitives.jsx'

/**
 * The masthead, laid out the way ESPN lays out theirs: a dark bar with the
 * logo and the competitions across it (ESPN's sports are our leagues), and a
 * white bar under it that changes with where you are. On a league's pages it
 * becomes that league's own menu, with its mark; everywhere else it carries
 * the site's sections and desks.
 */

/** Leagues named in the top bar, in this order; the rest live under More. */
const TOP_LEAGUES = ['NBA', 'WNBA', 'EuroLeague', 'FIBA', 'NCAAM', 'PBA', 'BLeague', 'KBL', 'CBA', 'NBL']

/* Which top-bar leagues fit at which width. Written out whole because
   Tailwind only compiles class names it can find in the source. */
const FIT = (i) => (i < 5 ? 'lg:flex' : i < 7 ? 'xl:flex' : '2xl:flex')

export const SECTIONS = [
  { to: '/', label: 'Home', end: true },
  { to: '/scores', label: 'Scores' },
  { to: '/stats', label: 'Stats' },
  { to: '/teams', label: 'Teams' },
  { to: '/margin', label: 'The Margin' },
  { to: '/free-minutes', label: 'Free Minutes' },
  { to: '/press', label: 'Full Court Press' },
  { to: '/opinion', label: 'Opinion' },
  { to: '/heritage-line', label: 'Heritage Line' },
  { to: '/archive', label: 'Archive' },
]

/** The league a page belongs to, read from its address, or null. */
export function useRouteLeague() {
  const { pathname, search } = useLocation()
  const m = pathname.match(/^\/(?:league|team|game|player)\/([^/]+)/)
  if (m) return getLeague(decodeURIComponent(m[1]))
  // A story sits under its league, as an ESPN article sits under its sport.
  const story = pathname.match(/^\/story\/([^/]+)/)
  if (story) return getLeague(getOriginal(decodeURIComponent(story[1]))?.league)
  if (/^\/(scores|stats|teams)$/.test(pathname)) {
    return getLeague(new URLSearchParams(search).get('league'))
  }
  return null
}

function useCloseOnOutside(open, setOpen) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, setOpen])
  return ref
}

function LeagueLogo({ league, size = 20, className = '' }) {
  if (!league?.logo) return null
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-paper ${className}`}
      style={{ width: size, height: size }}
    >
      <img src={league.logo} alt="" className="h-[78%] w-[78%] object-contain" loading="lazy" />
    </span>
  )
}

/** Every league, grouped by region, in a panel under "More". */
function MoreLeagues({ current }) {
  const [open, setOpen] = useState(false)
  const ref = useCloseOnOutside(open, setOpen)
  const { pathname } = useLocation()
  useEffect(() => setOpen(false), [pathname])

  return (
    <div ref={ref} className="relative hidden h-full lg:block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex h-full items-center gap-1 px-3 text-sm font-bold text-cream/85 hover:text-cream"
      >
        More Leagues
        <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true" className={open ? 'rotate-180' : ''}>
          <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 w-[40rem] rounded-b-lg border border-parchment bg-paper p-5 text-ink shadow-xl">
          <div className="grid grid-cols-2 gap-x-8 gap-y-5">
            {leaguesByGroup().map(({ group, leagues }) => (
              <div key={group}>
                <p className="eyebrow border-b border-parchment pb-2 text-ink/50">{group}</p>
                <ul className="mt-2">
                  {leagues.map((l) => (
                    <li key={l.key}>
                      <Link
                        to={`/league/${l.slug}`}
                        className={`flex items-center gap-2.5 rounded px-2 py-1.5 text-sm font-semibold hover:bg-cream ${
                          current?.key === l.key ? 'text-crimson' : ''
                        }`}
                      >
                        <LeagueLogo league={l} size={22} className="border border-parchment" />
                        <span className="flex-1">{l.name}</span>
                        <span className="text-xs font-normal text-ink/45">{l.region}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  )
}

/** Phone and tablet: everything in one panel under the bar. */
function Drawer({ onClose, current }) {
  return (
    <div className="fixed inset-x-0 bottom-0 top-14 z-40 overflow-y-auto bg-paper text-ink lg:hidden">
      <div className="px-4 py-5">
        <p className="eyebrow text-ink/50">Sections</p>
        <ul className="mt-2 grid grid-cols-2 gap-x-4">
          {SECTIONS.map((s) => (
            <li key={s.to}>
              <Link to={s.to} onClick={onClose} className="block border-b border-parchment py-3 text-base font-bold">
                {s.label}
              </Link>
            </li>
          ))}
          <li>
            <Link to="/about" onClick={onClose} className="block border-b border-parchment py-3 text-base font-bold">
              About
            </Link>
          </li>
        </ul>

        <InstallButton className="mt-5" />

        {leaguesByGroup().map(({ group, leagues }) => (
          <div key={group} className="mt-6">
            <p className="eyebrow text-ink/50">{group}</p>
            <ul className="mt-2 grid grid-cols-2 gap-2">
              {leagues.map((l) => (
                <li key={l.key}>
                  <Link
                    to={`/league/${l.slug}`}
                    onClick={onClose}
                    className={`flex min-h-12 items-center gap-2.5 rounded-lg border px-3 text-sm font-bold ${
                      current?.key === l.key ? 'border-crimson text-crimson' : 'border-parchment'
                    }`}
                  >
                    <LeagueLogo league={l} size={24} />
                    {l.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

function TopBar({ current }) {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const top = TOP_LEAGUES.map((k) => LEAGUES.find((l) => l.key === k)).filter(Boolean)

  return (
    <header className="sticky top-0 z-50 bg-night text-cream shadow-[0_1px_0_rgb(255_255_255/0.06)]">
      <div className="mx-auto flex h-14 max-w-[1440px] items-stretch px-2 sm:px-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="flex w-11 items-center justify-center lg:hidden"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            {open ? <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" /> : <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />}
          </svg>
        </button>

        {/* alt="" because the wordmark beside it already names the site. */}
        <Link to="/" className="flex shrink-0 items-center gap-2 pr-4 lg:pr-6" aria-label="Hoopspire home">
          <img src="/logo/mark.svg" alt="" width="30" height="30" className="h-[30px] w-[30px]" />
          <Wordmark onDark className="text-lg sm:text-xl" />
        </Link>

        <nav aria-label="Leagues" className="flex items-stretch">
          {top.map((l, i) => {
            const active = current?.key === l.key
            return (
              <Link
                key={l.key}
                to={`/league/${l.slug}`}
                className={`hidden items-center whitespace-nowrap border-b-[3px] px-3 pt-[3px] text-sm font-bold transition-colors ${FIT(i)} ${
                  active ? 'border-brand text-cream' : 'border-transparent text-cream/85 hover:text-cream hover:border-cream/40'
                }`}
              >
                {l.name}
              </Link>
            )
          })}
          <MoreLeagues current={current} />
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <Link
            to="/free-minutes"
            className="hidden items-center px-3 text-sm font-bold text-cream/85 hover:text-cream xl:flex"
          >
            Fantasy
          </Link>
          <Link
            to="/scores"
            className="mr-1 hidden items-center rounded-full bg-brand px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wide text-paper hover:bg-crimson sm:flex"
          >
            Scores
          </Link>
          <Link
            to="/archive?focus=1"
            aria-label="Search stories"
            className="flex h-11 w-11 items-center justify-center rounded-full text-cream/85 hover:bg-cream/10 hover:text-cream"
          >
            <SearchIcon />
          </Link>
        </div>
      </div>

      {open && <Drawer onClose={() => setOpen(false)} current={current} />}
    </header>
  )
}

function Tab({ to, label, active }) {
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={`flex shrink-0 items-center whitespace-nowrap border-b-[3px] px-3 pt-[3px] text-[0.8125rem] font-bold transition-colors ${
        active ? 'border-brand text-ink' : 'border-transparent text-ink/60 hover:text-ink'
      }`}
    >
      {label}
    </Link>
  )
}

/** The white bar: a league's own menu on its pages, the site's sections elsewhere. */
function SubNav({ current }) {
  const { pathname, search, hash } = useLocation()
  const q = new URLSearchParams(search).get('league')

  if (current) {
    const base = `/league/${current.slug}`
    const tabs = [
      { to: base, label: 'Home', active: pathname.startsWith('/league/') && hash !== '#standings' },
      { to: `/scores?league=${current.key}`, label: 'Scores', active: pathname === '/scores' },
      { to: `${base}#standings`, label: 'Standings', active: pathname.startsWith('/league/') && hash === '#standings' },
      { to: `/stats?league=${current.key}`, label: 'Stats', active: pathname === '/stats' },
      { to: `/teams?league=${current.key}`, label: 'Teams', active: pathname === '/teams' || pathname.startsWith('/team/') },
    ]
    return (
      <div className="border-b border-parchment bg-paper">
        <div className="no-scrollbar mx-auto flex h-12 max-w-[1440px] items-stretch overflow-x-auto px-2 sm:px-4">
          <Link to={base} className="mr-3 flex shrink-0 items-center gap-2 pr-3 sm:border-r sm:border-parchment">
            <LeagueLogo league={current} size={28} className="border border-parchment" />
            <span className="text-base font-extrabold tracking-tight">{current.name}</span>
          </Link>
          {tabs.map((t) => (
            <Tab key={t.label} {...t} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="border-b border-parchment bg-paper">
      <nav
        aria-label="Sections"
        className="no-scrollbar mx-auto flex h-11 max-w-[1440px] items-stretch overflow-x-auto px-2 sm:px-4"
      >
        {SECTIONS.map((s) => (
          <Tab
            key={s.to}
            to={s.to}
            label={s.label}
            active={(s.end ? pathname === s.to : pathname.startsWith(s.to)) && !(q && s.to !== '/')}
          />
        ))}
      </nav>
    </div>
  )
}

export default function Header() {
  const current = useRouteLeague()
  return (
    <>
      <TopBar current={current} />
      <SubNav current={current} />
    </>
  )
}

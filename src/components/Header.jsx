import { useState, useEffect, useRef } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { leaguesByGroup } from '../lib/leagues.js'
import InstallButton from './InstallButton.jsx'
import { Wordmark } from './Primitives.jsx'

const SECTIONS = [
  { to: '/margin', label: 'The Margin' },
  { to: '/free-minutes', label: 'Free Minutes' },
  { to: '/press', label: 'Full Court Press' },
  { to: '/opinion', label: 'Opinion' },
  { to: '/scores', label: 'Scores' },
  { to: '/stats', label: 'Stats' },
  { to: '/teams', label: 'Teams' },
]

/**
 * Leagues menu.
 *
 * There are too many competitions across four regions for an inline
 * nav — so they live in a grouped dropdown, keeping the masthead as spare as
 * the original design.
 */
function LeaguesMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const location = useLocation()

  useEffect(() => setOpen(false), [location.pathname])

  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const onLeagues = location.pathname.startsWith('/league/')

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`eyebrow transition-colors ${
          onLeagues ? 'text-crimson' : 'text-ink/70 hover:text-ink'
        }`}
      >
        Leagues <span className="ml-1 text-[8px]">▼</span>
      </button>

      {open && (
        <div className="absolute left-1/2 top-full z-50 mt-4 w-[34rem] -translate-x-1/2 border border-parchment bg-paper p-6 shadow-[6px_6px_0_0_var(--color-parchment)]">
          <div className="grid grid-cols-2 gap-x-8 gap-y-6">
            {leaguesByGroup().map(({ group, leagues }) => (
              <div key={group}>
                <p className="eyebrow border-b border-parchment pb-2 text-gold">{group}</p>
                <ul className="mt-3 space-y-2.5">
                  {leagues.map((l) => (
                    <li key={l.key}>
                      <Link
                        to={`/league/${l.slug}`}
                        className="group flex items-baseline justify-between gap-3"
                      >
                        <span className="font-display text-lg leading-none group-hover:text-crimson">
                          {l.name}
                        </span>
                        <span className="eyebrow shrink-0 text-ink/35">{l.region}</span>
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

export default function Header() {
  const [open, setOpen] = useState(false)

  const linkClass = ({ isActive }) =>
    `eyebrow transition-colors ${isActive ? 'text-crimson' : 'text-ink/70 hover:text-ink'}`

  return (
    <header className="sticky top-0 z-50 border-b border-parchment bg-cream/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3 md:px-8">
        {/*
          The mark is an <img> of an SVG rather than the full badge in
          /public/logo: the badge carries a wordmark, a tagline and a URL that
          are an unreadable blur below about 128px, and the header gives it 32.
          alt="" because the wordmark beside it already names the site — a
          screen reader announcing "Hoopspire Hoopspire" helps nobody.
        */}
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <img src="/logo/mark.svg" alt="" width="32" height="32" className="h-8 w-8" />
          <Wordmark className="text-xl" />
        </Link>

        {/* Nine sections and a dropdown need about 1,200px on one line with the
            wordmark and search. Below that the menu button takes over, rather
            than the labels wrapping onto two lines or running off the edge. */}
        <nav className="hidden items-center gap-5 whitespace-nowrap xl:flex 2xl:gap-7">
          <NavLink to="/" end className={linkClass}>
            Home
          </NavLink>
          <LeaguesMenu />
          {SECTIONS.map((n) => (
            <NavLink key={n.to} to={n.to} className={linkClass}>
              {n.label}
            </NavLink>
          ))}
        </nav>

        <Link
          to="/archive?focus=1"
          aria-label="Search stories"
          className="ml-auto flex h-11 w-11 items-center justify-center text-ink/70 transition-colors hover:text-crimson xl:h-9 xl:w-9"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
        </Link>

        <Link
          to="/about"
          className="hidden shrink-0 whitespace-nowrap border border-ink px-4 py-1.5 transition-colors hover:bg-ink hover:text-cream xl:block"
        >
          <span className="eyebrow">The Ledger</span>
        </Link>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Toggle navigation"
          className="min-h-11 border border-ink px-3 py-1.5 xl:hidden"
        >
          <span className="eyebrow">{open ? 'Close' : 'Menu'}</span>
        </button>
      </div>

      {open && (
        <nav className="border-t border-parchment px-4 py-5 xl:hidden">
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <NavLink to="/" end className={linkClass} onClick={() => setOpen(false)}>
              Home
            </NavLink>
            {SECTIONS.map((n) => (
              <NavLink key={n.to} to={n.to} className={linkClass} onClick={() => setOpen(false)}>
                {n.label}
              </NavLink>
            ))}
            <NavLink to="/about" className={linkClass} onClick={() => setOpen(false)}>
              The Ledger
            </NavLink>
          </div>

          <InstallButton className="mt-5" />

          {leaguesByGroup().map(({ group, leagues }) => (
            <div key={group} className="mt-5">
              <p className="eyebrow text-gold">{group}</p>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                {leagues.map((l) => (
                  <NavLink
                    key={l.key}
                    to={`/league/${l.slug}`}
                    className={linkClass}
                    onClick={() => setOpen(false)}
                  >
                    {l.name}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      )}
    </header>
  )
}

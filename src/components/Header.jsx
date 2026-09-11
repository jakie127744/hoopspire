import { useState, useEffect, useRef } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { leaguesByGroup } from '../lib/leagues.js'

const SECTIONS = [
  { to: '/margin', label: 'The Margin' },
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
      <div className="mx-auto flex max-w-7xl items-center gap-8 px-4 py-3 md:px-8">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <span className="text-xl leading-none">🏀</span>
          <span className="font-display text-2xl leading-none">
            Hoop<span className="text-crimson">spire</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
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
          to="/about"
          className="ml-auto hidden border border-ink px-4 py-1.5 transition-colors hover:bg-ink hover:text-cream lg:block"
        >
          <span className="eyebrow">The Ledger</span>
        </Link>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Toggle navigation"
          className="ml-auto border border-ink px-3 py-1.5 lg:hidden"
        >
          <span className="eyebrow">{open ? 'Close' : 'Menu'}</span>
        </button>
      </div>

      {open && (
        <nav className="border-t border-parchment px-4 py-5 lg:hidden">
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

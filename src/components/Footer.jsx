import { Link } from 'react-router-dom'
import { LEAGUES } from '../lib/leagues.js'
import { CookieSettingsLink } from './ConsentBanner.jsx'
import NewsletterSignup from './NewsletterSignup.jsx'

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-parchment bg-ink text-cream">
      <div className="mx-auto max-w-7xl px-4 pt-14 md:px-8">
        <div className="[&_.eyebrow]:text-gold [&_h2]:text-cream [&_input]:border-cream/20 [&_input]:bg-cream/5 [&_input]:text-cream [&_p]:text-cream/60 [&_span]:text-cream/60 [&_button]:border-cream [&_button]:bg-cream [&_button]:text-ink">
          <NewsletterSignup variant="compact" />
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-4 md:px-8">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2">
            <span className="text-xl leading-none">🏀</span>
            <span className="font-display text-3xl leading-none">
              Hoop<span className="text-gold">spire</span>
            </span>
          </div>
          <p className="mt-4 max-w-sm text-sm text-cream/60">
            Heritage of the Hardwood. A global ledger for the game's greatest leagues — every box
            score a blueprint, every headline history.
          </p>
        </div>

        <div>
          <p className="eyebrow text-gold">Leagues</p>
          <ul className="mt-4 space-y-2">
            {LEAGUES.map((l) => (
              <li key={l.key}>
                <Link
                  to={`/league/${l.slug}`}
                  className="text-sm text-cream/60 transition-colors hover:text-cream"
                >
                  {l.fullName}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="eyebrow text-gold">Sections</p>
          <ul className="mt-4 space-y-2">
            {[
              ['/', 'Home'],
              ['/margin', 'The Margin'],
              ['/scores', 'Live Scores'],
              ['/stats', 'Statistics'],
              ['/teams', 'Teams & Rosters'],
              ['/about', 'The Ledger'],
              ['/contact', 'Contact'],
              ['/privacy', 'Privacy'],
              ['/terms', 'Terms'],
            ].map(([to, label]) => (
              <li key={to}>
                <Link
                  to={to}
                  className="text-sm text-cream/60 transition-colors hover:text-cream"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-cream/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 md:flex-row md:items-center md:justify-between md:px-8">
          <p className="eyebrow text-cream/40">
            © {new Date().getFullYear()} Hoopspire. All hardwood reserved.
          </p>
          <div className="flex items-center gap-4">
            <CookieSettingsLink className="eyebrow text-cream/40 transition-colors hover:text-cream" />
            <p className="font-display text-sm italic text-cream/40">
              "The ball don't lie." — The Hardwood
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}

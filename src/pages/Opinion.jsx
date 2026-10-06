import { useState } from 'react'
import { getDesk } from '../lib/articles.js'
import { deskStaff } from '../lib/staff.js'
import { LEAGUES, LEAGUE_COUNT_WORD } from '../lib/leagues.js'
import ArticleCard from '../components/ArticleCard.jsx'
import NewsletterSignup from '../components/NewsletterSignup.jsx'
import { SectionHead, Empty, Eyebrow } from '../components/Primitives.jsx'
import { useMeta } from '../lib/meta.js'

/**
 * Opinion — the column desk (owner, 2026-10-06).
 *
 * Built on the Press page so the two read as siblings, and kept separate from
 * it so an argument is never filed next to a report as if it were one. The
 * columnists' facts are checked like everyone else's; the opinions are theirs.
 *
 * (Below: the original Full Court Press notes this page was adapted from.)
 *
 * Full Court Press — the news desk.
 *
 * The other two desks argue from numbers: The Margin from box scores, Free
 * Minutes from projections. This one reports what happened — signings, trades,
 * results, injuries, federation decisions — and it exists because a ledger
 * that only ever publishes analysis has nothing to say on the day a league
 * actually does something.
 *
 * The masthead is printed on the page rather than buried, because a news desk
 * asks to be trusted in a way an analysis desk does not, and a reader deserves
 * to know on sight who covers which corner of thirteen leagues — and on what
 * terms. See /about for what a byline on this site means.
 */
export default function Opinion() {
  useMeta({
    title: 'Opinion',
    description:
      'Columns on basketball across fourteen leagues: what we think of the decisions, the players and the game, with every fact underneath checked.',
  })
  const [league, setLeague] = useState('ALL')
  const all = getDesk('opinion')
  const staff = deskStaff('opinion')

  const written = LEAGUES.filter((l) => all.some((a) => a.league === l.key))
  const shown = league === 'ALL' ? all : all.filter((a) => a.league === league)
  const [lead, ...rest] = shown

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 md:px-8">
      <Eyebrow className="text-ink/50">Argued here</Eyebrow>
      <h1 className="mt-3 text-6xl md:text-7xl">Opinion</h1>
      <p className="mt-4 max-w-2xl text-lg text-ink/65">
        What we think, and why. Second Look, Hot Hand and Jump Ball, across all{' '}
        {LEAGUE_COUNT_WORD.toLowerCase()} leagues in the ledger. The opinions belong to the
        columnist. The facts under them are checked like everything else here.
      </p>

      {staff.length > 0 && (
        <div className="mt-10 grid gap-px border border-parchment bg-parchment sm:grid-cols-2">
          {staff.map((s) => (
            <div key={s.id} className="bg-paper p-5">
              <p className="font-display text-xl">{s.byline}</p>
              <Eyebrow className="mt-1 block text-ink/40">
                {s.role}
              </Eyebrow>
              <p className="mt-3 text-sm leading-relaxed text-ink/65">{s.beat}</p>
              <p className="mt-3 border-t border-parchment pt-3 text-xs leading-relaxed text-ink/45">
                {s.method}
              </p>
            </div>
          ))}
        </div>
      )}

      {written.length > 1 && (
        <div className="no-scrollbar mt-8 flex gap-2 overflow-x-auto border-b border-parchment pb-4">
          {[{ key: 'ALL', name: 'All' }, ...written].map((l) => (
            <button
              key={l.key}
              type="button"
              onClick={() => setLeague(l.key)}
              className={`shrink-0 border px-4 py-2 transition-colors ${
                league === l.key
                  ? 'border-ink bg-ink text-cream'
                  : 'border-parchment hover:border-ink'
              }`}
            >
              <Eyebrow>{l.name}</Eyebrow>
            </button>
          ))}
        </div>
      )}

      {!shown.length ? (
        <div className="mt-12">
          <Empty
            title="Nothing filed yet."
            hint="The first columns are on the way."
          />
        </div>
      ) : (
        <>
          <div className="mt-12">
            <ArticleCard article={lead} variant="lead" />
          </div>

          {rest.length > 0 && (
            <section className="mt-16">
              <SectionHead title="More">
                <span className="font-mono text-sm text-ink/40">{shown.length}</span>
              </SectionHead>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {rest.map((a) => (
                  <ArticleCard key={a.id} article={a} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <div className="mt-20">
        <NewsletterSignup />
      </div>
    </div>
  )
}

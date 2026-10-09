import { useState } from 'react'
import { getDesk } from '../lib/articles.js'
import { LEAGUES, LEAGUE_COUNT_WORD } from '../lib/leagues.js'
import ArticleCard from '../components/ArticleCard.jsx'
import NewsletterSignup from '../components/NewsletterSignup.jsx'
import { SectionHead, Empty, Eyebrow } from '../components/Primitives.jsx'
import { useMeta } from '../lib/meta.js'

/**
 * Full Court Press — the news desk.
 *
 * The other two desks argue from numbers: The Margin from box scores, Free
 * Minutes from projections. This one reports what happened — signings, trades,
 * results, injuries, federation decisions — and it exists because a ledger
 * that only ever publishes analysis has nothing to say on the day a league
 * actually does something.
 *
 * Bylines and their method notes appear on each article, not here: a grid of
 * every writer on the desk page pushed the stories below the fold (owner,
 * 2026-10-08). See /about for what a byline on this site means.
 */
export default function Press() {
  useMeta({
    title: 'Full Court Press',
    description:
      'Basketball news across fourteen leagues — signings, movement, results and the decisions behind them, from the NBA and WNBA to the PBA, KBL, B.League and EuroLeague.',
  })
  const [league, setLeague] = useState('ALL')
  const all = getDesk('news')

  const written = LEAGUES.filter((l) => all.some((a) => a.league === l.key))
  const shown = league === 'ALL' ? all : all.filter((a) => a.league === league)
  const [lead, ...rest] = shown

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 md:px-8">
      <Eyebrow className="text-ink/50">Reported here</Eyebrow>
      <h1 className="mt-3 text-6xl md:text-7xl">Full Court Press</h1>
      <p className="mt-4 max-w-2xl text-lg text-ink/65">
        What happened, and what it changed. News from all{' '}
        {LEAGUE_COUNT_WORD.toLowerCase()} leagues in the ledger — not only the one everybody
        covers, and not a week later.
      </p>

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
            hint="Add a Markdown file to /content/news — or run `npm run new -- &quot;Headline&quot; --desk news`."
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

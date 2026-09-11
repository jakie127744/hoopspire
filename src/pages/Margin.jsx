import { useState } from 'react'
import { getOriginals } from '../lib/articles.js'
import { LEAGUES, LEAGUE_COUNT_WORD } from '../lib/leagues.js'
import ArticleCard from '../components/ArticleCard.jsx'
import NewsletterSignup from '../components/NewsletterSignup.jsx'
import { SectionHead, Empty, Eyebrow } from '../components/Primitives.jsx'

/**
 * The Margin — the site's own writing.
 *
 * Named for both meanings: the margin of victory, and the notes written in the
 * margin. Everything here is analysis built from the numbers the rest of the
 * site collects, which is the one thing an aggregator cannot copy.
 */
export default function Margin() {
  const [league, setLeague] = useState('ALL')
  const all = getOriginals()

  // Only offer filters for leagues we have actually written about.
  const written = LEAGUES.filter((l) => all.some((a) => a.league === l.key))
  const shown = league === 'ALL' ? all : all.filter((a) => a.league === league)

  const [lead, ...rest] = shown

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 md:px-8">
      <Eyebrow className="text-gold">Written here</Eyebrow>
      <h1 className="mt-3 text-6xl md:text-7xl">The Margin</h1>
      <p className="mt-4 max-w-2xl text-lg text-ink/65">
        Basketball argued from the numbers. Every piece here is built on the box scores,
        standings and season averages the ledger already keeps — across all{' '}
        {LEAGUE_COUNT_WORD.toLowerCase()} leagues,
        not just the one everybody covers.
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
            title="Nothing published yet."
            hint="Add a Markdown file to /content/articles — or run `npm run cms`."
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

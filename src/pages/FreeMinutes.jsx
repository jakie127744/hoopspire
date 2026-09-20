import { useState } from 'react'
import { getDesk, DESKS } from '../lib/articles.js'
import { deskLead } from '../lib/staff.js'
import ArticleCard from '../components/ArticleCard.jsx'
import NewsletterSignup from '../components/NewsletterSignup.jsx'
import { SectionHead, Empty, Eyebrow } from '../components/Primitives.jsx'
import { formatDate } from '../lib/format.js'
import { useMeta } from '../lib/meta.js'

/**
 * Free Minutes — the NBA fantasy desk.
 *
 * Named twice over, the way The Margin is. Minutes are the currency of
 * fantasy value: almost every projection reduces to per-minute production
 * multiplied by an assumption about playing time. And free minutes are the
 * ones a trade, a departure or an injury has just put back on the table,
 * which is where most draft-day and waiver-day value comes from.
 *
 * The desk publishes one piece a day. That cadence is stated on the page
 * rather than implied, because fantasy advice is worthless the moment it goes
 * stale and a reader deserves to know how fresh what they are reading is.
 *
 * Filters here are by format, not by league. Everything on this desk is NBA,
 * so the useful question is not which competition but whether a piece applies
 * to the reader's league: head-to-head categories, roto, or points.
 */
export default function FreeMinutes() {
  useMeta({ title: 'Free Minutes', description: 'The fantasy basketball desk: usage, minutes and the rotations that decide a week, read straight from the box scores.' })
  const [tag, setTag] = useState('ALL')
  const all = getDesk('fantasy')
  const lead = deskLead('fantasy')

  // Only offer a filter for tags that actually exist, so the row never
  // contains a button that returns nothing.
  const tags = [...new Set(all.map((a) => a.tag).filter(Boolean))]
  const shown = tag === 'ALL' ? all : all.filter((a) => a.tag === tag)

  const [top, ...rest] = shown
  const latest = all[0]

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 md:px-8">
      <Eyebrow className="text-crimson">The fantasy desk</Eyebrow>
      <h1 className="mt-3 text-6xl md:text-7xl">Free Minutes</h1>
      <p className="mt-4 max-w-2xl text-lg text-ink/65">
        NBA fantasy argued from the numbers. Projections, category math and roster
        construction for head-to-head, roto and points leagues, built on minutes and
        possessions rather than on last season's rankings. One piece a day.
      </p>

      {/*
        The desk's terms, published where a reader meets the desk rather than
        buried in an About page. A projection is a claim, and a reader should
        be able to see the standard it was held to before acting on it.
      */}
      {lead && (
        <div className="mt-8 flex flex-wrap items-baseline gap-x-4 gap-y-2 border-l-2 border-crimson bg-paper px-5 py-4">
          <p className="font-display text-xl leading-none">{lead.byline}</p>
          <Eyebrow className="text-ink/45">{lead.role}</Eyebrow>
          <p className="w-full text-sm text-ink/60">{lead.method}</p>
        </div>
      )}

      {latest && (
        <p className="eyebrow mt-6 text-ink/40">
          Last filed {formatDate(latest.published, { month: 'long' })}
        </p>
      )}

      {tags.length > 1 && (
        <div className="no-scrollbar mt-8 flex gap-2 overflow-x-auto border-b border-parchment pb-4">
          {['ALL', ...tags].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTag(t)}
              className={`shrink-0 border px-4 py-2 transition-colors ${
                tag === t ? 'border-ink bg-ink text-cream' : 'border-parchment hover:border-ink'
              }`}
            >
              <Eyebrow>{t === 'ALL' ? 'All' : t}</Eyebrow>
            </button>
          ))}
        </div>
      )}

      {!shown.length ? (
        <div className="mt-12">
          <Empty
            title="The desk hasn't filed yet."
            hint="Add a Markdown file to /content/fantasy, or run `npm run new -- --desk fantasy`."
          />
        </div>
      ) : (
        <>
          <div className="mt-12">
            <ArticleCard article={top} variant="lead" />
          </div>

          {rest.length > 0 && (
            <section className="mt-16">
              <SectionHead title="The rest of the desk">
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

      <p className="mt-16 max-w-2xl border-t border-parchment pt-6 text-sm text-ink/50">
        {DESKS.fantasy.name} is analysis, not advice about money. Nothing here is a
        betting recommendation, and no projection survives an injury report. Check the
        late scratches before you set a lineup.
      </p>

      <div className="mt-12">
        <NewsletterSignup />
      </div>
    </div>
  )
}

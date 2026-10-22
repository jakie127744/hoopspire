import { useState } from 'react'
import { getDesk } from '../lib/articles.js'
import ArticleCard from '../components/ArticleCard.jsx'
import NewsletterSignup from '../components/NewsletterSignup.jsx'
import { SectionHead, Empty, Eyebrow } from '../components/Primitives.jsx'
import { useMeta } from '../lib/meta.js'

/**
 * Heritage Line, the scouting desk (owner, 2026-10-18).
 *
 * Young players growing up outside the country they could play for, with a
 * connection to it that has been verified: a passport, a parent, a
 * grandparent. Each report says where FIBA's eligibility rules leave the
 * player, because for a national team that is the whole question: a passport
 * held early makes a player local, and one acquired late makes them the one
 * naturalised player a team is allowed.
 *
 * The desk is run by the FIBA writers already on the masthead (owner,
 * 2026-10-18): two columns a week, one player each, from Victor Ashby and
 * Noor Haddad, and news from Amara Diallo only when there is an eligibility
 * ruling. Every piece goes through the same editorial pipeline and lint as
 * the desks they come from.
 *
 * Built on the Opinion page, but filtered by nation rather than by league:
 * nearly every piece is `league: FIBA`, and the reader's question is which
 * national team, not which competition.
 */
export default function HeritageLine() {
  useMeta({
    title: 'Heritage Line',
    description:
      'Scouting reports on young basketball players abroad with a verified passport, parent or grandparent tie to another country, and where FIBA eligibility rules put them in that national team pipeline.',
  })
  const [nation, setNation] = useState('ALL')
  const all = getDesk('scouting')

  const nations = [...new Set(all.map((a) => a.nation).filter(Boolean))].sort()
  const shown = nation === 'ALL' ? all : all.filter((a) => a.nation === nation)
  const [lead, ...rest] = shown

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 md:px-8">
      <Eyebrow className="text-gold">The scouting desk</Eyebrow>
      <h1 className="mt-3 text-4xl md:text-5xl">Heritage Line</h1>
      <p className="mt-4 max-w-2xl text-lg text-ink/65">
        Young players growing up outside the country they could represent. Every player here has
        a verified tie to that country, through a passport, a parent or a grandparent, and every
        report says where FIBA's eligibility rules leave them: a local player, the one naturalised
        place a national team is allowed, or not settled yet.
      </p>
      <p className="mt-3 max-w-2xl text-sm text-ink/50">
        Two columns a week, one player each: Second Look by Victor Ashby on the Americas, Hot
        Hand by Noor Haddad on everywhere else. When a federation or FIBA rules on a player's
        eligibility, Amara Diallo, our FIBA writer, reports it as news. The opinions belong to
        the columnists; the facts under them are checked like everything else here.
      </p>

      {nations.length > 1 && (
        <div className="no-scrollbar mt-8 flex gap-2 overflow-x-auto border-b border-parchment pb-4">
          {['ALL', ...nations].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNation(n)}
              className={`shrink-0 border px-4 py-2 transition-colors ${
                nation === n ? 'border-ink bg-ink text-cream' : 'border-parchment hover:border-ink'
              }`}
            >
              <Eyebrow>{n === 'ALL' ? 'All' : n}</Eyebrow>
            </button>
          ))}
        </div>
      )}

      {!shown.length ? (
        <div className="mt-12">
          <Empty title="No reports filed yet." hint="The first scouting reports are on the way." />
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

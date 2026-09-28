import { useAsync } from '../lib/useAsync.js'
import { getAllNews } from '../lib/api.js'
import ArticleCard from '../components/ArticleCard.jsx'
import { Loading, Empty, Eyebrow } from '../components/Primitives.jsx'
import { useMeta } from '../lib/meta.js'

/**
 * On the Wire — everyone else's reporting, entirely on its own page.
 *
 * This used to be a section on the home page, sitting near an ad, next to
 * nine cards of other outlets' headlines reproduced with their own bylines.
 * Google's AdSense review flagged that arrangement as ads served on
 * replicated content. The fix was not a different position for the ad — it
 * was that this content carries no ad anywhere, ever, and that it lives on
 * one page of its own rather than bleeding into the home page and every
 * league page's news feed. League.jsx and Home.jsx now show only our own
 * writing; this is the only page on the site where a third-party headline
 * appears at all.
 *
 * No AdSlot is imported here on purpose. Do not add one.
 */
export default function Wire() {
  useMeta({
    title: 'On the Wire',
    description:
      'Basketball news from outlets across the ledger’s thirteen leagues — headlines and standfirsts only, each one linking to where it was actually reported.',
    // Nothing on this page is ours to rank for; it is entirely other
    // publishers' headlines, credited and linked to them. Kept out of search
    // results and the sitemap on purpose — see the note above the export.
    noindex: true,
  })
  const { data: news, loading } = useAsync(() => getAllNews(6), [], [])

  // getAllNews folds in our own cross-league pieces, which is right for a
  // mixed feed and wrong on a page whose entire point is "not ours".
  const wire = (news || []).filter((a) => !a.original)

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 md:px-8">
      <Eyebrow className="text-ink/50">Reported elsewhere</Eyebrow>
      <h1 className="mt-3 text-6xl md:text-7xl">On the Wire</h1>
      <p className="mt-4 max-w-2xl text-lg text-ink/65">
        Basketball news from other publishers, across every league in the ledger. Each card
        carries its outlet's own byline and links out to the original story — nothing here is
        reproduced beyond a headline and the standfirst the feed supplies.
      </p>

      <div className="mt-12">
        {loading ? (
          <Loading label="Pulling the wire" />
        ) : wire.length ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {wire.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        ) : (
          <Empty title="No stories on the wire right now." />
        )}
      </div>
    </div>
  )
}

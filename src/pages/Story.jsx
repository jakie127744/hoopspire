import { useEffect } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { getOriginal, getOriginals, getDesk, findOriginalIgnoringCase, renderBody, relatedOriginals, DESKS } from '../lib/articles.js'
import { HeadlineList, DeskCard } from '../components/NewsBlocks.jsx'
import { CONNECTIONS, FIBA_STATUS } from '../lib/scouting.js'
import { disclosureText } from '../lib/affiliate.js'
import { getStaff } from '../lib/staff.js'
import NewsletterSignup from '../components/NewsletterSignup.jsx'
import { getLeague } from '../lib/leagues.js'
import { Eyebrow, SectionHead, DeskTag } from '../components/Primitives.jsx'
import ArticleCard, { DeskBadge } from '../components/ArticleCard.jsx'
import AdSlot from '../components/AdSlot.jsx'
import Reactions from '../components/Reactions.jsx'
import ShareButtons from '../components/ShareButtons.jsx'
import { SITE } from '../lib/site.js'
import { formatDate } from '../lib/format.js'
import { useMeta } from '../lib/meta.js'

export default function Story() {
  const { slug } = useParams()
  const article = getOriginal(slug)
  const league = article?.league ? getLeague(article.league) : null
  // Back should return the reader to the desk they came from, not always to
  // The Margin. `desk` is absent only if an article predates the split.
  const desk = DESKS[article?.desk] || DESKS.margin

  // Search engines and social cards read the title; an article that never
  // updates it is invisible in a tab strip full of identical names. useMeta
  // also emits the canonical and Open Graph tags, which matters more here
  // than anywhere else on the site: an article is the thing people share.
  useMeta({
    title: article?.title,
    description: article?.description,
    image: article?.image || undefined,
    type: 'article',
  })

  // A reader still running an older copy of the app (an open tab, or a service
  // worker installed before network-first pages) cannot know about a story
  // published since. Before saying it does not exist, fetch the newest
  // version once, switch to it and reload. The sessionStorage guard means a
  // slug that really does not exist is reloaded at most once per tab.
  const missing = !article && !findOriginalIgnoringCase(slug)
  useEffect(() => {
    if (!missing || typeof navigator === 'undefined' || !navigator.serviceWorker) return
    const key = `hs-fresh-${slug}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {
      return
    }
    navigator.serviceWorker.getRegistration().then(async (reg) => {
      if (!reg) return window.location.reload()
      await reg.update().catch(() => {})
      const next = reg.waiting || reg.installing
      if (!next) return window.location.reload()
      navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true })
      next.postMessage({ type: 'SKIP_WAITING' })
      // An installing worker may not take messages yet: reload regardless.
      setTimeout(() => window.location.reload(), 4000)
    })
  }, [missing, slug])

  if (!article) {
    const meant = findOriginalIgnoringCase(slug)
    if (meant) return <Navigate to={meant.href} replace />
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 md:px-8">
        <h1 className="text-4xl">That story isn't in the ledger.</h1>
        <Link to="/margin" className="eyebrow mt-6 inline-block text-crimson">
          ← The Margin
        </Link>
      </div>
    )
  }

  const writer = article.byline ? getStaff(article.byline) : null
  const related = relatedOriginals(article)
  const { html, partners } = renderBody(article.body)

  const headlines = getOriginals()
    .filter((a) => a.slug !== article.slug)
    .slice(0, 8)
  const deskLatest = getDesk(article.desk || 'margin')
    .filter((a) => a.slug !== article.slug)
    .slice(0, 3)

  return (
    <div className="mx-auto grid max-w-[1440px] gap-4 px-3 py-4 sm:px-4 md:py-5 lg:grid-cols-[minmax(0,1fr)_20rem] xl:gap-5">
    <article className="card min-w-0 px-4 py-6 sm:px-8 md:px-12 md:py-9">
      <div className="mx-auto max-w-3xl">
      <Link to={desk.path} className="eyebrow text-ink/45 hover:text-crimson">
        ← {desk.name}
      </Link>

      <header className="mt-6">
        <div className="flex flex-wrap items-center gap-2">
          {league && (
            <Link to={`/league/${league.slug}`} className="eyebrow font-bold text-crimson">
              {league.name}
            </Link>
          )}
          {league && <span className="text-parchment">·</span>}
          <Eyebrow className="text-ink/50">{article.tag}</Eyebrow>
          <DeskBadge article={article} />
        </div>

        <h1 className="mt-4 font-display text-[2rem] leading-[1.08] md:text-[2.75rem]">{article.title}</h1>

        {article.description && (
          <p className="mt-4 text-lg leading-relaxed text-ink/70 md:text-xl">{article.description}</p>
        )}

        {/* Heritage Line's eligibility file: the player and the facts every report is built on. */}
        {article.desk === 'scouting' && article.nation && (
          <dl className="mt-6 grid gap-x-8 gap-y-2 border-l-2 border-gold bg-paper px-5 py-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {article.player && (
              <div>
                <dt className="eyebrow text-ink/45">Player</dt>
                <dd className="mt-1 text-ink">{article.player}</dd>
              </div>
            )}
            <div>
              <dt className="eyebrow text-ink/45">National team</dt>
              <dd className="mt-1 text-ink">{article.nation}</dd>
            </div>
            <div>
              <dt className="eyebrow text-ink/45">Connection</dt>
              <dd className="mt-1 text-ink">{CONNECTIONS[article.connection] || article.connection}</dd>
            </div>
            <div>
              <dt className="eyebrow text-ink/45">FIBA status</dt>
              <dd className="mt-1 text-ink">{FIBA_STATUS[article.fibaStatus] || article.fibaStatus}</dd>
            </div>
          </dl>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-parchment pt-5">
          <p className="eyebrow text-ink/45">
            {article.byline && (
              <>
                By {article.byline}
                <DeskTag />
                {' · '}
              </>
            )}
            {formatDate(article.published, { month: 'long' })}
            {article.readingTime ? ` · ${article.readingTime} min read` : ''}
          </p>
          <ShareButtons slug={article.slug} title={article.title} />
        </div>
      </header>

      {article.image && (
        <figure className="mt-10">
          <div className="aspect-[16/9] overflow-hidden border border-parchment bg-parchment">
            <img src={article.image} alt="" className="h-full w-full object-cover object-[50%_20%]" />
          </div>
          {article.imageCredit && (
            <figcaption className="eyebrow mt-2 text-ink/35">{article.imageCredit}</figcaption>
          )}
        </figure>
      )}

      {/*
        Affiliate disclosure goes ABOVE the body on purpose. Regulators require
        it to be clear and to come before the reader acts on a link — a note in
        the footer is too late to count.
      */}
      {partners.length > 0 && (
        <p className="mt-10 border-l-2 border-gold bg-paper px-5 py-4 text-sm text-ink/70">
          {disclosureText(partners)}
        </p>
      )}

      {/*
        The body is our own Markdown, compiled at build time from files in this
        repo — not remote or user-submitted content — so rendering it directly
        introduces no injection surface.
      */}
      <div
        className="mt-10 text-lg leading-relaxed text-ink/80
          [&_a]:text-crimson [&_a]:underline
          [&_blockquote]:border-l-2 [&_blockquote]:border-gold [&_blockquote]:pl-5 [&_blockquote]:font-display [&_blockquote]:text-xl [&_blockquote]:italic [&_blockquote]:text-ink/70
          [&_code]:bg-paper [&_code]:px-1 [&_code]:font-mono [&_code]:text-sm
          [&_h2]:mb-4 [&_h2]:mt-12 [&_h2]:border-b [&_h2]:border-parchment [&_h2]:pb-2 [&_h2]:font-display [&_h2]:text-3xl
          [&_h3]:mb-3 [&_h3]:mt-9 [&_h3]:font-display [&_h3]:text-2xl
          [&_hr]:my-10 [&_hr]:border-parchment
          [&_img]:my-8 [&_img]:w-full [&_img]:border [&_img]:border-parchment
          [&_li]:mb-2 [&_ol]:mb-6 [&_ol]:list-decimal [&_ol]:pl-6
          [&_p]:mb-6
          [&_table]:mb-8 [&_table]:w-full [&_table]:border-collapse
          [&_td]:border-b [&_td]:border-parchment [&_td]:py-2
          [&_th]:border-b [&_th]:border-ink [&_th]:py-2 [&_th]:text-left [&_th]:font-mono [&_th]:text-xs [&_th]:uppercase [&_th]:tracking-widest
          [&_ul]:mb-6 [&_ul]:list-disc [&_ul]:pl-6"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <Reactions slug={article.slug} />

      <div className="mt-8">
        <ShareButtons slug={article.slug} title={article.title} />
      </div>

      <footer className="mt-14 border-t border-parchment pt-6">
        {/* The writer's standing method note lives here, not on the desk page. */}
        {writer && (
          <p className="mb-3 text-xs leading-relaxed text-ink/45">
            <span className="font-semibold text-ink/60">{writer.byline}</span>
            <DeskTag />, {writer.role}.{' '}
            {writer.method}
          </p>
        )}
        <p className="text-sm text-ink/55">
          Written for Hoopspire{article.byline ? ` by ${article.byline}` : ''}. Spotted an error?{' '}
          <Link to="/contact" className="text-crimson underline">
            Tell us
          </Link>{' '}
          — corrections make the ledger better.
        </p>
      </footer>

      {/*
        The ad sits after the body, never inside it. An article broken up by
        an ad reads as if the ad were part of the argument, and Google's own
        placement policy treats anything that ambiguous as an invitation to
        accidental clicks.

        It also sits below the corrections line rather than directly under the
        reactions. An ad pressed against a row of buttons is the other thing
        that placement policy is about: a reader reaching for "Great read"
        should not be able to land on an advertisement instead.

        Gated on length. AdSense's low-value-content finding traced to
        published pieces as short as 167 words carrying an ad — a thin page
        does not stop being thin because it has a paragraph, and it must
        never be the one with an ad on it. 500 is the floor the desks are
        already held to; this is what enforces it in code rather than trusting
        every future piece to clear it on its own.
      */}
      {article.wordCount >= 500 && (
        <div className="mt-14 border-t border-parchment pt-6">
          <AdSlot slotId={SITE.adSlots.square.id} format={SITE.adSlots.square.format} />
        </div>
      )}

      <div className="mt-14">
        <NewsletterSignup />
      </div>

      {related.length > 0 && (
        <section className="mt-20">
          <SectionHead title={`More from ${desk.name}`} />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        </section>
      )}
      </div>
    </article>

    <aside className="min-w-0 space-y-4">
      <div className="space-y-4 lg:sticky lg:top-[4.5rem]">
        <HeadlineList articles={headlines} />
        <DeskCard desk={article.desk || 'margin'} articles={deskLatest} />
      </div>
    </aside>
    </div>
  )
}

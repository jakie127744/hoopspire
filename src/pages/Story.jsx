import { useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getOriginal, renderBody, relatedOriginals } from '../lib/articles.js'
import { getLeague } from '../lib/leagues.js'
import { Eyebrow, SectionHead } from '../components/Primitives.jsx'
import ArticleCard from '../components/ArticleCard.jsx'
import { formatDate } from '../lib/format.js'

export default function Story() {
  const { slug } = useParams()
  const article = getOriginal(slug)
  const league = article?.league ? getLeague(article.league) : null

  // Search engines and social cards read the title; an article that never
  // updates it is invisible in a tab strip full of identical names.
  useEffect(() => {
    if (!article) return
    const previous = document.title
    document.title = `${article.title} — Hoopspire`
    const meta = document.querySelector('meta[name="description"]')
    const previousDesc = meta?.getAttribute('content')
    if (meta && article.description) meta.setAttribute('content', article.description)
    return () => {
      document.title = previous
      if (meta && previousDesc) meta.setAttribute('content', previousDesc)
    }
  }, [article])

  if (!article) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 md:px-8">
        <h1 className="text-4xl">That story isn't in the ledger.</h1>
        <Link to="/originals" className="eyebrow mt-6 inline-block text-crimson">
          ← All originals
        </Link>
      </div>
    )
  }

  const related = relatedOriginals(article)

  return (
    <article className="mx-auto max-w-3xl px-4 py-14 md:px-8">
      <Link to="/originals" className="eyebrow text-ink/45 hover:text-crimson">
        ← Originals
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
          <span className="border border-gold px-1.5 py-0.5 text-gold">
            <Eyebrow className="font-bold">Original</Eyebrow>
          </span>
        </div>

        <h1 className="mt-4 font-display text-4xl leading-[1.05] md:text-6xl">{article.title}</h1>

        {article.description && (
          <p className="mt-5 text-xl leading-relaxed text-ink/70">{article.description}</p>
        )}

        <p className="eyebrow mt-6 border-t border-parchment pt-5 text-ink/45">
          {article.byline ? `By ${article.byline} · ` : ''}
          {formatDate(article.published, { month: 'long' })}
          {article.readingTime ? ` · ${article.readingTime} min read` : ''}
        </p>
      </header>

      {article.image && (
        <figure className="mt-10">
          <div className="aspect-[16/9] overflow-hidden border border-parchment bg-parchment">
            <img src={article.image} alt="" className="h-full w-full object-cover" />
          </div>
          {article.imageCredit && (
            <figcaption className="eyebrow mt-2 text-ink/35">{article.imageCredit}</figcaption>
          )}
        </figure>
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
        dangerouslySetInnerHTML={{ __html: renderBody(article.body) }}
      />

      <footer className="mt-14 border-t border-parchment pt-6">
        <p className="text-sm text-ink/55">
          Written for Hoopspire{article.byline ? ` by ${article.byline}` : ''}. Spotted an error?{' '}
          <Link to="/contact" className="text-crimson underline">
            Tell us
          </Link>{' '}
          — corrections make the ledger better.
        </p>
      </footer>

      {related.length > 0 && (
        <section className="mt-20">
          <SectionHead title="More originals" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        </section>
      )}
    </article>
  )
}

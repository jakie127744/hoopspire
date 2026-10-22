import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getLeague, LEAGUES } from '../lib/leagues.js'
import { DESKS } from '../lib/articles.js'
import { relativeDay } from '../lib/format.js'
import { SECTIONS } from './Header.jsx'

/**
 * The building blocks of an ESPN-style page: the hero story, the feed card,
 * the headline list and the rail cards. Shared by the front page, the league
 * pages and the article page so they read as one site.
 */

/** "NBA · The Margin · Yesterday" */
function Kicker({ article, className = '' }) {
  const league = getLeague(article.league)
  return (
    <p className={`flex flex-wrap items-center gap-x-1.5 text-xs font-bold text-ink/55 ${className}`}>
      {league?.logo && (
        <span className="inline-flex h-4 w-4 items-center justify-center">
          <img src={league.logo} alt="" className="max-h-4 max-w-4 object-contain" loading="lazy" />
        </span>
      )}
      <span className="uppercase tracking-wide text-crimson">{league?.name || article.league || 'Hoopspire'}</span>
      <span aria-hidden="true">·</span>
      <span>{article.deskName || DESKS[article.desk]?.name || 'The Margin'}</span>
      <span aria-hidden="true">·</span>
      <span className="font-medium">{relativeDay(article.published)}</span>
    </p>
  )
}

/**
 * Stand-in art for a piece with no photo, which is most of them: the
 * league's mark on a navy field, so it still reads as a sports page.
 */
function LeagueArt({ article, large = false }) {
  const league = getLeague(article.league)
  const [ok, setOk] = useState(true)
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_30%_20%,#22406a_0%,#13233b_55%,#0c1828_100%)]">
      <span
        aria-hidden="true"
        className={`absolute -bottom-4 -right-2 select-none font-display uppercase leading-none text-cream/[0.06] ${
          large ? 'text-[9rem] md:text-[12rem]' : 'text-[5.5rem]'
        }`}
      >
        {league?.name || 'Hoop'}
      </span>
      {league?.logo && ok ? (
        <span
          className={`relative flex items-center justify-center rounded-full bg-paper shadow-lg ${
            large ? 'h-28 w-28 md:h-36 md:w-36' : 'h-16 w-16'
          }`}
        >
          <img
            src={league.logo}
            alt=""
            loading="lazy"
            onError={() => setOk(false)}
            className="h-[70%] w-[70%] object-contain"
          />
        </span>
      ) : (
        <img src="/logo/mark.svg" alt="" className={large ? 'h-28 w-28' : 'h-14 w-14'} />
      )}
      <span className="absolute bottom-0 left-0 h-1 w-full bg-brand" />
    </div>
  )
}

function Art({ article, large }) {
  const [ok, setOk] = useState(true)
  if (article.image && ok) {
    return (
      <img
        src={article.image}
        alt={article.imageCaption || ''}
        loading={large ? 'eager' : 'lazy'}
        onError={() => setOk(false)}
        className="h-full w-full object-cover object-[50%_20%] transition-transform duration-500 group-hover:scale-[1.03]"
      />
    )
  }
  return <LeagueArt article={article} large={large} />
}

/** The lead story: full-width art, a big headline, the standfirst. */
export function HeroStory({ article, more = [] }) {
  return (
    <article className="card overflow-hidden">
      <Link to={article.href} className="group block">
        <div className={`overflow-hidden bg-ink ${article.image ? 'aspect-[16/9]' : 'aspect-[16/9] sm:aspect-[21/9]'}`}>
          <Art article={article} large />
        </div>
        <div className="px-4 pb-4 pt-4 md:px-6 md:pt-5">
          <Kicker article={article} />
          <h2 className="mt-2 text-[1.75rem] leading-[1.1] group-hover:underline md:text-[2.25rem]">
            {article.title}
          </h2>
          {article.description && (
            <p className="mt-2.5 text-base leading-snug text-ink/70 md:text-lg">{article.description}</p>
          )}
          {article.byline && (
            <p className="mt-3 text-xs font-semibold text-ink/50">
              {article.byline}
              {article.readingTime ? ` · ${article.readingTime} min read` : ''}
            </p>
          )}
        </div>
      </Link>
      {more.length > 0 && (
        <ul className="border-t border-parchment px-4 py-2 md:px-6">
          {more.map((a) => (
            <li key={a.id}>
              <Link
                to={a.href}
                className="flex items-start gap-2.5 py-2 text-[0.9375rem] font-bold leading-snug hover:text-crimson"
              >
                <span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                {a.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

/** One story in the feed: the ESPN content card. */
export function FeedCard({ article }) {
  return (
    <article className="card overflow-hidden">
      <Link to={article.href} className="group grid sm:grid-cols-[minmax(0,1fr)_15rem] md:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="order-2 flex flex-col p-4 sm:order-1 md:p-5">
          <Kicker article={article} />
          <h3 className="mt-2 text-xl leading-tight group-hover:underline md:text-[1.375rem]">{article.title}</h3>
          {article.description && (
            <p className="mt-2 line-clamp-3 text-[0.9375rem] leading-snug text-ink/65">{article.description}</p>
          )}
          {article.byline && <p className="mt-auto pt-3 text-xs font-semibold text-ink/45">{article.byline}</p>}
        </div>
        <div className="order-1 aspect-[16/9] overflow-hidden bg-ink sm:order-2 sm:aspect-auto sm:min-h-[10rem]">
          <Art article={article} />
        </div>
      </Link>
    </article>
  )
}

/** A white rail card with a title row. */
export function RailCard({ title, action, children, className = '' }) {
  return (
    <section className={`card overflow-hidden ${className}`}>
      <div className="card-head">
        <h2 className="text-[0.9375rem]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

/** ESPN's "Top Headlines": a tight list of linked titles. */
export function HeadlineList({ title = 'Top Headlines', articles, action, className }) {
  if (!articles.length) return null
  return (
    <RailCard title={title} action={action} className={className}>
      <ul className="px-4 py-1.5">
        {articles.map((a) => (
          <li key={a.id} className="border-b border-parchment last:border-0">
            <Link to={a.href} className="block py-2.5 text-sm font-bold leading-snug hover:text-crimson">
              {a.title}
            </Link>
          </li>
        ))}
      </ul>
    </RailCard>
  )
}

/** A desk's latest, with the desk's name as the title. */
export function DeskCard({ desk, articles }) {
  const d = DESKS[desk]
  if (!d || !articles.length) return null
  return (
    <RailCard
      title={d.name}
      action={
        <Link to={d.path} className="text-xs font-bold text-crimson hover:underline">
          See all
        </Link>
      }
    >
      <ul className="px-4 py-1.5">
        {articles.map((a) => (
          <li key={a.id} className="border-b border-parchment last:border-0">
            <Link to={a.href} className="group flex gap-3 py-2.5">
              <span className="h-12 w-[4.5rem] shrink-0 overflow-hidden rounded bg-ink">
                <Art article={a} />
              </span>
              <span className="min-w-0">
                <span className="line-clamp-2 text-sm font-bold leading-snug group-hover:text-crimson">{a.title}</span>
                <span className="mt-0.5 block text-xs text-ink/50">{relativeDay(a.published)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </RailCard>
  )
}

/** The left column on wide screens, like ESPN's quick links. */
export function QuickLinks() {
  return (
    <div className="space-y-4">
      <RailCard title="Leagues">
        <ul className="py-1.5">
          {LEAGUES.map((l) => (
            <li key={l.key}>
              <Link
                to={`/league/${l.slug}`}
                className="flex items-center gap-2.5 px-4 py-1.5 text-sm font-semibold hover:bg-cream hover:text-crimson"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                  {l.logo && <img src={l.logo} alt="" className="max-h-6 max-w-6 object-contain" loading="lazy" />}
                </span>
                {l.name}
              </Link>
            </li>
          ))}
        </ul>
      </RailCard>
      <RailCard title="Hoopspire">
        <ul className="py-1.5">
          {SECTIONS.filter((s) => s.to !== '/').map((s) => (
            <li key={s.to}>
              <Link to={s.to} className="block px-4 py-1.5 text-sm font-semibold hover:bg-cream hover:text-crimson">
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </RailCard>
    </div>
  )
}

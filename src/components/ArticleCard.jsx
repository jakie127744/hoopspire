import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LeagueTag, Eyebrow } from './Primitives.jsx'
import { formatDate, relativeTime } from '../lib/format.js'

/**
 * Article card.
 *
 * Two kinds of item flow through here:
 *
 *   The Margin — our own writing. These link to a route on this site and
 *   carry a badge, because the distinction between what we wrote and what we
 *   merely indexed should never be ambiguous to a reader.
 *
 *   Wire items — someone else's reporting. We show the headline, dek and
 *   byline and link to the publisher. The copy stays theirs.
 */

const LANGUAGE_NAMES = { pt: 'Portuguese', 'zh-TW': 'Chinese', zh: 'Chinese', ja: 'Japanese', ko: 'Korean' }

/**
 * "Translated from Portuguese" — shown on headlines we machine-translated.
 * A translated headline is not the publisher's own English, and the reader
 * should know that before they click through to a page in another language.
 * The original title is kept as a tooltip.
 */
function TranslatedNote({ article, className = '' }) {
  if (!article.translatedFrom) return null
  const lang = LANGUAGE_NAMES[article.translatedFrom] || article.translatedFrom
  return (
    <p
      className={`eyebrow text-ink/35 ${className}`}
      title={article.originalTitle ? `Original: ${article.originalTitle}` : undefined}
    >
      Machine-translated from {lang}
    </p>
  )
}

/** Marks our own writing where it sits alongside wire items. */
function MarginBadge() {
  return (
    <span className="border border-gold px-1.5 py-0.5 text-gold">
      <Eyebrow className="font-bold">The Margin</Eyebrow>
    </span>
  )
}

export default function ArticleCard({ article, variant = 'list' }) {
  // Some publishers block hotlinked images. Track the failure so the card
  // collapses to text instead of framing an empty grey slab.
  const [imageOk, setImageOk] = useState(true)
  const showImage = !!article.image && imageOk

  const isOriginal = !!article.original

  // Our own pieces stay in the SPA. Wire items open in this tab on purpose, so the
  // browser's Back button returns the reader here — a _blank tab has no
  // history, which makes Back dead on arrival.
  const Wrapper = isOriginal ? Link : article.url ? 'a' : 'div'
  const linkProps = isOriginal
    ? { to: article.href }
    : article.url
      ? { href: article.url, rel: 'noreferrer' }
      : {}

  const Meta = ({ className = '' }) => (
    <p className={`eyebrow text-ink/40 ${className}`}>
      {article.byline ? `${article.byline} · ` : ''}
      {formatDate(article.published)}
      {isOriginal && article.readingTime ? ` · ${article.readingTime} min read` : ''}
    </p>
  )

  const Kicker = () => (
    <div className="flex flex-wrap items-center gap-2">
      <LeagueTag league={article.league || 'Hoopspire'} tag={article.tag} />
      {isOriginal && <MarginBadge />}
    </div>
  )

  if (variant === 'lead') {
    return (
      <Wrapper {...linkProps} className="group block">
        {showImage && (
          <figure className="mb-5">
            <div className="aspect-[16/9] overflow-hidden border border-parchment bg-parchment">
              <img
                src={article.image}
                alt={article.imageCaption || ''}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
                onError={() => setImageOk(false)}
              />
            </div>
            {article.imageCredit && (
              <figcaption className="eyebrow mt-2 text-ink/35">{article.imageCredit}</figcaption>
            )}
          </figure>
        )}
        <Kicker />
        <h3 className="mt-3 font-display text-3xl leading-tight md:text-5xl">
          <span className="link-underline">{article.title}</span>
        </h3>
        {article.description && (
          <p className="mt-4 max-w-2xl text-lg text-ink/70">{article.description}</p>
        )}
        <Meta className="mt-5 text-ink/45" />
        <TranslatedNote article={article} className="mt-1" />
      </Wrapper>
    )
  }

  if (variant === 'compact') {
    return (
      <Wrapper {...linkProps} className="group block border-b border-parchment py-4 last:border-0">
        <Kicker />
        <h4 className="mt-2 font-display text-xl leading-snug">
          <span className="link-underline">{article.title}</span>
        </h4>
        <p className="eyebrow mt-2 text-ink/40">
          {article.byline ? `${article.byline} · ` : ''}
          {relativeTime(article.published)}
        </p>
        <TranslatedNote article={article} className="mt-1" />
      </Wrapper>
    )
  }

  return (
    <Wrapper {...linkProps} className="group card flex flex-col overflow-hidden">
      {showImage && (
        <div className="aspect-[16/9] overflow-hidden bg-parchment">
          <img
            src={article.image}
            alt={article.imageCaption || ''}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
            onError={() => setImageOk(false)}
          />
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <Kicker />
        <h4 className="mt-3 font-display text-2xl leading-tight">
          <span className="link-underline">{article.title}</span>
        </h4>
        {article.description && (
          <p className="mt-3 line-clamp-3 text-sm text-ink/65">{article.description}</p>
        )}
        <Meta className="mt-auto pt-5" />
        <TranslatedNote article={article} className="mt-1" />
      </div>
    </Wrapper>
  )
}

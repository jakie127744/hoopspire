import { SITE } from '../lib/site.js'

/**
 * Share to Facebook and X.
 *
 * Plain links to each platform's share page, not their widget scripts: the
 * official buttons load third-party code that sets cookies before a reader has
 * agreed to anything, which the consent banner would then have to gate. A link
 * does the same job and sends nothing until the reader clicks it.
 *
 * The URL shared is the canonical one, built from the slug, so a share from a
 * preview or a link with tracking parameters still points at the real page.
 */
export default function ShareButtons({ slug, title }) {
  const url = `https://${SITE.domain}/story/${slug}`
  const links = [
    {
      name: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      icon: (
        <path d="M13.5 22v-8.2h2.8l.4-3.2h-3.2V8.6c0-.9.3-1.6 1.6-1.6h1.7V4.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.4H7.3v3.2h2.8V22h3.4z" />
      ),
    },
    {
      name: 'X',
      href: `https://x.com/intent/post?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
      icon: (
        <path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L1.8 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z" />
      ),
    },
  ]

  return (
    <div className="flex items-center gap-2">
      <span className="eyebrow text-ink/45">Share</span>
      {links.map((l) => (
        <a
          key={l.name}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Share on ${l.name}`}
          title={`Share on ${l.name}`}
          className="flex h-8 w-8 items-center justify-center border border-parchment text-ink/60 transition-colors hover:border-ink hover:text-ink"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
            {l.icon}
          </svg>
        </a>
      ))}
    </div>
  )
}

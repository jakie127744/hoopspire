import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { SITE } from './site.js'

/**
 * Per-route document metadata.
 *
 * Every route used to inherit the one <title> and <meta description> baked
 * into index.html, so thirteen pages described themselves identically. To a
 * crawler that reads as one page duplicated thirteen times rather than a site
 * with thirteen pages.
 *
 * This is still client-side — the HTML a crawler receives before running any
 * JavaScript is the empty shell, and no amount of head-tag management changes
 * that. Prerendering is the real fix. What this does do is make the rendered
 * page describe itself correctly, which is what Googlebot indexes and what a
 * shared link unfurls into.
 */

const ORIGIN = `https://${SITE.domain}`

/** Create the tag if it is missing, then set it. Never duplicates. */
function setTag(selector, attrs) {
  let el = document.head.querySelector(selector)
  if (!el) {
    el = document.createElement(selector.startsWith('link') ? 'link' : 'meta')
    document.head.appendChild(el)
  }
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  return el
}

/**
 * @param title       Page title, without the site name — it is appended.
 *                    Pass null on the home page, which is already named.
 * @param description One or two sentences. Falls back to the site default.
 * @param image       Absolute URL for the social card, if the page has one.
 * @param type        Open Graph type: 'website' (default) or 'article'.
 */
export function useMeta({ title, description, image, type = 'website' } = {}) {
  const { pathname } = useLocation()

  useEffect(() => {
    const fullTitle = title ? `${title} — ${SITE.name}` : `${SITE.name} — ${SITE.tagline}`
    const desc =
      description ||
      `Scores, standings, rosters and stats across thirteen basketball leagues, from Manila to Madrid to São Paulo.`

    // The canonical is built from the path, never from window.location, so a
    // visit carrying ?utm_source=… does not declare itself a separate page.
    const canonical = `${ORIGIN}${pathname === '/' ? '/' : pathname.replace(/\/$/, '')}`

    document.title = fullTitle
    setTag('meta[name="description"]', { name: 'description', content: desc })
    setTag('link[rel="canonical"]', { rel: 'canonical', href: canonical })

    setTag('meta[property="og:title"]', { property: 'og:title', content: fullTitle })
    setTag('meta[property="og:description"]', { property: 'og:description', content: desc })
    setTag('meta[property="og:url"]', { property: 'og:url', content: canonical })
    setTag('meta[property="og:type"]', { property: 'og:type', content: type })
    setTag('meta[property="og:site_name"]', { property: 'og:site_name', content: SITE.name })

    setTag('meta[name="twitter:card"]', {
      name: 'twitter:card',
      content: image ? 'summary_large_image' : 'summary',
    })
    setTag('meta[name="twitter:title"]', { name: 'twitter:title', content: fullTitle })
    setTag('meta[name="twitter:description"]', { name: 'twitter:description', content: desc })

    if (image) {
      setTag('meta[property="og:image"]', { property: 'og:image', content: image })
      setTag('meta[name="twitter:image"]', { name: 'twitter:image', content: image })
    } else {
      // A leftover image from the previous route would misdescribe this one.
      document.head.querySelector('meta[property="og:image"]')?.remove()
      document.head.querySelector('meta[name="twitter:image"]')?.remove()
    }
  }, [title, description, image, type, pathname])
}

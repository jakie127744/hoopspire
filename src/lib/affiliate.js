/**
 * Affiliate link handling.
 *
 * Two things have to happen to every affiliate link, and both are easy to
 * forget by hand — so neither is left to the author:
 *
 *   1. `rel="sponsored nofollow"`. Google requires paid or affiliate links to
 *      be marked. Unmarked affiliate links are a manual-action risk for the
 *      whole site, not just the page.
 *
 *   2. A visible disclosure. The FTC (US), CMA/ASA (UK), and equivalents
 *      elsewhere require it to be clear, prominent and *before* the reader
 *      acts — a line in the footer does not count. `Story.jsx` renders the
 *      notice above the article body whenever this module finds a partner
 *      link.
 *
 * Partners are declared in `SITE.affiliates`. With none declared, every
 * function here is a no-op and nothing changes.
 */
import { SITE } from './site.js'

const partners = () => SITE.affiliates || []

/** Does this href point at a declared partner? */
export function partnerFor(href) {
  if (!href) return null
  let host
  try {
    host = new URL(href, 'https://example.com').hostname.toLowerCase()
  } catch {
    return null
  }
  return (
    partners().find((p) => {
      const h = String(p.host || '').toLowerCase()
      return h && (host === h || host.endsWith(`.${h}`))
    }) || null
  )
}

/** Append the partner's tracking parameter, without clobbering an existing one. */
function tagged(href, partner) {
  if (!partner.param || !partner.value) return href
  try {
    const url = new URL(href)
    if (!url.searchParams.has(partner.param)) {
      url.searchParams.set(partner.param, partner.value)
    }
    return url.toString()
  } catch {
    return href
  }
}

/**
 * Rewrite affiliate anchors in rendered article HTML.
 *
 * Runs on a string rather than the DOM because article bodies are compiled at
 * build time — there is no document to walk, and doing it here means the
 * markup is already correct the first time it paints.
 *
 * @returns {{ html: string, partners: string[] }} the rewritten HTML and the
 *   distinct partner names found, which drive the disclosure text.
 */
export function decorateAffiliateLinks(html) {
  if (!html || !partners().length) return { html: html || '', partners: [] }

  const found = new Set()

  const out = html.replace(/<a\s+([^>]*?)href="([^"]+)"([^>]*)>/gi, (match, pre, href, post) => {
    const partner = partnerFor(href)
    if (!partner) return match

    found.add(partner.name || partner.host)

    // Drop any rel the author wrote so ours is authoritative, then rebuild.
    // The boundary must allow start-of-string: `<a rel="nofollow" href=...>`
    // puts rel first, with no leading whitespace, and a `\srel=` pattern
    // silently misses it — emitting two rel attributes, where browsers honour
    // the first and ours is ignored.
    const attrs = `${pre} ${post}`.replace(/(^|\s)rel="[^"]*"/gi, ' ').replace(/\s+/g, ' ').trim()
    const finalHref = tagged(href, partner)

    return `<a ${attrs ? `${attrs} ` : ''}href="${finalHref}" rel="sponsored nofollow noopener" data-affiliate="${partner.name || partner.host}">`
  })

  return { html: out, partners: [...found] }
}

/** Wording for the on-page disclosure. */
export function disclosureText(names = []) {
  const who =
    names.length === 0
      ? 'some retailers'
      : names.length === 1
        ? names[0]
        : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

  return `This article contains affiliate links. If you buy something through a link to ${who}, we may earn a commission at no extra cost to you. It never affects what we write or which results we report.`
}

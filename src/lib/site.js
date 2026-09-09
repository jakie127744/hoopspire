/**
 * Site-wide identity and legal configuration.
 *
 * ⚠️  FILL THESE IN BEFORE PUBLISHING. The legal pages read from this file, so
 * everything below appears verbatim in your Privacy Policy, Terms and Contact
 * pages. Anything left as a TODO renders a visible warning on the page rather
 * than quietly shipping a placeholder — deliberately, so it cannot slip past.
 *
 * These documents are a working starting point written for a sports data and
 * news-aggregation site. They are NOT legal advice. Have a lawyer review them
 * before you rely on them, especially if you take EEA/UK traffic or run ads.
 */
export const SITE = {
  name: 'Hoopspire',
  tagline: 'Heritage of the Hardwood',
  domain: 'hoopspire.com', // TODO: confirm once registered

  /** The person or company legally responsible for the site. */
  legalEntity: 'TODO: your name or registered company name',

  /** Registered/business address. Required by GDPR if you serve EU traffic. */
  address: 'TODO: your business address',

  /** Contact addresses. A working inbox is an AdSense review requirement. */
  email: 'TODO: hello@yourdomain.com',
  privacyEmail: 'TODO: privacy@yourdomain.com',

  /** Governing law for the Terms, e.g. 'the Philippines' or 'England and Wales'. */
  jurisdiction: 'TODO: your country or state',

  /** Shown as "Last updated" on the legal pages. Bump when you edit them. */
  lastUpdated: '2026-09-09',

  /**
   * Advertising network. Ad slots stay completely inert — no script, no empty
   * frames — until BOTH of these are set and the reader consents.
   *
   *   'adsense'  → Google AdSense      (publisherId is your `ca-pub-…`)
   *   'medianet' → Media.net           (publisherId is your customer ID)
   *   'ezoic'    → Ezoic               (publisherId is your site ID)
   *   null       → no ads (default)
   */
  adNetwork: null,
  adsensePublisherId: null,
}

/** True when a config value is still an unfilled placeholder. */
export const isTodo = (value) => typeof value === 'string' && value.startsWith('TODO')

/** Render a config value, or a visible warning if it was never filled in. */
export const orWarn = (value) => (isTodo(value) ? `[${value}]` : value)

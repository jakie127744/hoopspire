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

  /**
   * Newsletter.
   *
   * The signup form renders nothing at all until `provider` and `endpoint`
   * are both set, so the site never ships a form that silently fails.
   *
   *   'kit'        → Kit (formerly ConvertKit). endpoint = your form ID.
   *                  Posts JSON and reads a real success/error response.
   *   'buttondown' → endpoint = your Buttondown username.
   *   'custom'     → endpoint = any URL accepting a POST with an `email` field.
   *
   * Kit is the one that gives proper inline error handling; the others submit
   * natively and hand the reader to the provider's own confirmation page.
   */
  newsletter: {
    provider: null,
    endpoint: null,
    title: 'The Asian basketball brief',
    pitch:
      'One email a week: what actually happened across the PBA, KBL, B.League, CBA and TPBL — with the numbers.',
  },

  /**
   * Affiliate partners.
   *
   * Any link in an article pointing at one of these hosts is automatically
   * tagged `rel="sponsored nofollow"`, given your tracking parameter, and
   * triggers a visible disclosure on the article.
   *
   * Disclosure is not optional: the FTC (US), CMA/ASA (UK) and equivalents
   * require it to be clear and unavoidable, not buried in a footer.
   *
   * `param`/`value` are appended to the URL when both are set — leave them
   * null for partners whose tracking lives in the path.
   */
  affiliates: [
    // { host: 'amazon.com', name: 'Amazon', param: 'tag', value: 'yourtag-20' },
    // { host: 'amazon.co.jp', name: 'Amazon Japan', param: 'tag', value: 'yourtag-22' },
  ],
}

/** True when a config value is still an unfilled placeholder. */
export const isTodo = (value) => typeof value === 'string' && value.startsWith('TODO')

/** Render a config value, or a visible warning if it was never filled in. */
export const orWarn = (value) => (isTodo(value) ? `[${value}]` : value)

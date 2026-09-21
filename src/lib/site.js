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
  domain: 'hoopspire.com',

  /**
   * Who is legally responsible. Hoopspire is a personal project, not a
   * registered company, so this names an individual operator rather than an
   * entity — which is what it is, and AdSense has never required otherwise.
   */
  legalEntity: 'an individual, as a personal project',

  /**
   * Where that operator is based. A hobby site publishing a home address
   * helps nobody, so this gives the state and routes the full address through
   * email on request — which keeps a real channel open without putting a
   * private residence on a public page.
   */
  address: 'Florida, United States (full postal address available on request by email)',

  /** Contact addresses. A working inbox is an AdSense review requirement. */
  email: 'hoopspire77@gmail.com',
  privacyEmail: 'hoopspire77@gmail.com',

  /** Governing law for the Terms, e.g. 'the Philippines' or 'England and Wales'. */
  jurisdiction: 'the State of Florida, United States',

  /** Shown as "Last updated" on the legal pages. Bump when you edit them. */
  lastUpdated: '2026-09-21',

  /**
   * Advertising network. Ad slots stay completely inert — no script, no empty
   * frames — until BOTH of these are set and the reader consents.
   *
   *   'adsense'  → Google AdSense      (publisherId is your `ca-pub-…`)
   *   'medianet' → Media.net           (publisherId is your customer ID)
   *   'ezoic'    → Ezoic               (publisherId is your site ID)
   *   null       → no ads (default)
   */
  adNetwork: 'adsense',
  adsensePublisherId: 'ca-pub-9907028021598445',

  /**
   * Ad unit IDs, kept here rather than typed into pages, so a unit can be
   * repointed in one place. These belong to the AdSense account above and are
   * shared with the chess site — they serve fine, but AdSense reports per
   * unit, so the two sites' numbers land in the same row until Hoopspire gets
   * units of its own.
   *
   * `format` must match how the unit was created in AdSense: 'autorelaxed'
   * for a Multiplex unit, 'auto' for a display unit. A mismatch renders blank.
   */
  adSlots: {
    /** Multiplex — a grid of suggestions, at home in a feed of cards. */
    feed: { id: '3330215112', format: 'autorelaxed' },
    /** Square display unit, for the end of an article. */
    square: { id: '8128575211', format: 'auto' },
  },

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

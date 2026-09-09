/**
 * The leagues in the Hoopspire ledger.
 *
 * `source` decides where the data comes from at runtime:
 *   'espn'     — fetched live in the browser from ESPN's public JSON
 *                (CORS-open, no key, no proxy).
 *   'snapshot' — read from /public/data/<key>.json, produced by
 *                `npm run data` (see scripts/fetch-data.mjs). Used for the
 *                three Asian leagues, which have no CORS-open public API.
 *
 * `group` drives the navigation menu and the home-page rail.
 * `tier: 'core'` marks the five founding leagues that get the hero rail; the
 * rest are still first-class, just not on the front page.
 */
export const LEAGUES = [
  // ── International ────────────────────────────────────────────────────────
  {
    key: 'FIBA',
    slug: 'FIBA',
    name: 'FIBA',
    fullName: 'FIBA Basketball World Cup',
    region: 'International',
    group: 'International',
    source: 'espn',
    espnSlug: 'fiba',
    site: 'https://www.fiba.basketball',
    tier: 'core',
  },

  // ── North America ────────────────────────────────────────────────────────
  {
    key: 'NBA',
    slug: 'NBA',
    name: 'NBA',
    fullName: 'National Basketball Association',
    region: 'North America',
    group: 'Americas',
    source: 'espn',
    espnSlug: 'nba',
    site: 'https://www.nba.com',
    tier: 'core',
    /**
     * Postseason format, used to build the "if the playoffs started today"
     * view. Only declared for leagues whose format we have actually verified
     * — the tab does not appear for the others rather than guessing.
     *
     *   berths  — seeds that qualify outright
     *   playIn  — inclusive seed range entering the play-in tournament
     *   bracket — first-round pairings by seed
     */
    playoffFormat: {
      grouping: 'conference',
      berths: 6,
      playIn: [7, 10],
      bracket: [
        [1, 8],
        [4, 5],
        [3, 6],
        [2, 7],
      ],
    },
  },
  {
    key: 'WNBA',
    slug: 'WNBA',
    name: 'WNBA',
    fullName: "Women's National Basketball Association",
    region: 'North America',
    group: 'Americas',
    source: 'espn',
    espnSlug: 'wnba',
    site: 'https://www.wnba.com',
  },
  {
    key: 'GLeague',
    slug: 'GLeague',
    name: 'G League',
    fullName: 'NBA G League',
    region: 'North America',
    group: 'Americas',
    source: 'espn',
    espnSlug: 'nba-development',
    site: 'https://gleague.nba.com',
  },
  {
    key: 'NCAAM',
    slug: 'NCAAM',
    name: 'NCAA',
    fullName: "NCAA Men's Basketball",
    region: 'United States',
    group: 'Americas',
    source: 'espn',
    espnSlug: 'mens-college-basketball',
    // ESPN rejects a date range for college basketball unless a group is
    // given; 50 is Division I, which is what the ledger covers.
    espnParams: 'groups=50',
    site: 'https://www.ncaa.com/sports/basketball-men',
  },

  // ── South America ────────────────────────────────────────────────────────
  {
    key: 'NBB',
    slug: 'NBB',
    name: 'NBB',
    fullName: 'Novo Basquete Brasil',
    region: 'Brazil',
    group: 'Americas',
    source: 'espn',
    espnSlug: 'nbb',
    site: 'https://lnb.com.br',
  },

  // ── Europe ───────────────────────────────────────────────────────────────
  {
    key: 'EuroLeague',
    slug: 'EuroLeague',
    name: 'EuroLeague',
    fullName: 'Turkish Airlines EuroLeague',
    region: 'Europe',
    group: 'Europe',
    source: 'euroleague',
    espnSlug: 'euroleague',
    site: 'https://www.euroleaguebasketball.net',
    tier: 'core',
  },

  // ── Asia-Pacific (no CORS-open API — snapshot-backed) ────────────────────
  {
    key: 'PBA',
    slug: 'PBA',
    name: 'PBA',
    fullName: 'Philippine Basketball Association',
    region: 'Philippines',
    group: 'Asia-Pacific',
    source: 'snapshot',
    site: 'https://www.pba.ph',
    tier: 'core',
  },
  {
    key: 'KBL',
    slug: 'KBL',
    name: 'KBL',
    fullName: 'Korean Basketball League',
    region: 'South Korea',
    group: 'Asia-Pacific',
    source: 'snapshot',
    site: 'https://www.kbl.or.kr',
    tier: 'core',
  },
  {
    key: 'BLeague',
    slug: 'BLeague',
    name: 'B.League',
    fullName: 'Japan Professional Basketball League',
    region: 'Japan',
    group: 'Asia-Pacific',
    source: 'snapshot',
    site: 'https://www.bleague.jp',
    tier: 'core',
  },
  {
    key: 'CBA',
    slug: 'CBA',
    name: 'CBA',
    fullName: 'Chinese Basketball Association',
    region: 'China',
    group: 'Asia-Pacific',
    source: 'snapshot',
    site: 'https://www.cba.gov.cn',
  },
  {
    key: 'TPBL',
    slug: 'TPBL',
    name: 'TPBL',
    fullName: 'Taiwan Professional Basketball League',
    region: 'Taiwan',
    group: 'Asia-Pacific',
    source: 'snapshot',
    site: 'https://www.tpbl.basketball',
  },
  {
    key: 'NBL',
    slug: 'NBL',
    name: 'NBL',
    fullName: 'National Basketball League (Australia)',
    region: 'Australia',
    group: 'Asia-Pacific',
    source: 'espn',
    espnSlug: 'nbl',
    site: 'https://nbl.com.au',
  },
]

export const LEAGUE_KEYS = LEAGUES.map((l) => l.key)

/** The five founding leagues shown on the home-page hero rail. */
export const CORE_LEAGUES = LEAGUES.filter((l) => l.tier === 'core')

export const GROUPS = ['International', 'Americas', 'Europe', 'Asia-Pacific']

export function leaguesByGroup() {
  return GROUPS.map((group) => ({
    group,
    leagues: LEAGUES.filter((l) => l.group === group),
  })).filter((g) => g.leagues.length)
}

export function getLeague(key) {
  if (!key) return null
  const needle = String(key).toLowerCase().replace(/[.\s-]/g, '')
  return (
    LEAGUES.find((l) => l.key.toLowerCase() === needle) ||
    LEAGUES.find((l) => l.name.toLowerCase().replace(/[.\s-]/g, '') === needle) ||
    null
  )
}

# Hoopspire — Heritage of the Hardwood

A global basketball ledger across thirteen competitions, plus original writing.
Every score, standing, roster and headline is fetched from the competitions
themselves or from working news desks. **Nothing on this site is invented.**

Rebuilt standalone from a base44 prototype — no base44 SDK, API or runtime.

```bash
npm install
npm run dev      # http://localhost:5173
npm run cms      # article editor at http://127.0.0.1:5180
npm run data     # refresh the scraped leagues (PBA, KBL, B.League, CBA, TPBL)
npm run build    # production build to dist/
```

## Leagues

| League | Region | Data source | Live? |
|---|---|---|---|
| FIBA World Cup | International | ESPN public JSON | ✅ live |
| NBA | North America | ESPN public JSON | ✅ live |
| WNBA | North America | ESPN public JSON | ✅ live |
| NBA G League | North America | ESPN public JSON | ✅ live |
| NCAA Men's | United States | ESPN public JSON | ✅ live |
| NBB | Brazil | ESPN public JSON | ✅ live |
| EuroLeague | Europe | EuroLeague official feeds | ✅ live |
| PBA | Philippines | Wikipedia + PH news desks | snapshot |
| KBL | South Korea | RealGM stats + asia-basket + Yonhap | snapshot |
| B.League | Japan | bleague.jp + Japan Times | snapshot |
| CBA | China | asia-basket + RealGM stats + SCMP | snapshot |
| TPBL | Taiwan | TPBL official API + asia-basket | snapshot |
| NBL | Australia | ESPN public JSON | ✅ live |

## How the data works

There are two kinds of feed, and the UI renders both through the same
normalised shapes (see `src/lib/api.js`).

**Live leagues** are read directly in the browser. ESPN's public JSON and
EuroLeague Basketball's own feeds are unauthenticated and CORS-open, so there
is no API key, no server and no proxy anywhere in this project.

**Snapshot leagues** — the PBA, KBL, B.League, CBA and TPBL publish no
CORS-open API, so
`npm run data` scrapes their sources into `public/data/<League>.json`, which the
app reads as static files.

## Writing your own articles

Original pieces live as Markdown in `content/articles/*.md`. Vite bundles them
at build time, so there is no CMS, no database and no backend — add a file and
it appears on the site.

### Two editors, same files

```bash
npm run cms       # local editor at http://127.0.0.1:5180
```

A small Node app that reads and writes `content/articles/*.md` directly. No
auth, no network, no database — it binds to `127.0.0.1` only, restricts slugs
to safe characters, verifies every resolved path stays inside the content
folder, and moves deletions to `content/articles/.trash` rather than unlinking
them. Do not expose it on a public host.

**`/admin` — git-based CMS** ([Sveltia](https://github.com/sveltia/sveltia-cms),
Decap-compatible). This is the deployed editor: sign in with GitHub, and every
save becomes a real commit, so content shares the code's history and rollback
story. It needs the site deployed plus one auth step — see the comments at the
top of `public/admin/config.yml`.

Both edit the same Markdown, so you can move between them freely. Or just:

```bash
cp content/articles/_TEMPLATE.md content/articles/my-piece.md
# edit it, delete `draft: true`, done
```

The filename becomes the URL: `my-piece.md` publishes at `/story/my-piece`.
`content/articles/_TEMPLATE.md` documents every frontmatter field.

**Why this matters:** aggregated headlines are a service, but original writing
is what ad networks, search engines and readers actually value — and it is the
single thing standing between this site and an AdSense rejection for
"scraped content". See *Monetisation* below.

Originals are woven through the whole site, not siloed:

- they appear on `/originals`, and on their league's page;
- they are merged into the same feeds as wire items, and **outrank** any wire
  item published the same day;
- they carry a gold **Original** badge, so a reader is never unclear about what
  you wrote versus what you indexed;
- they open on this site rather than linking away.

Set `draft: true` to keep a file out of the build entirely.

## Monetisation

Realistically, a site that is **only** an aggregator gets rejected by AdSense
and every other reputable network under their scraped/low-value content rules.
The networks that would accept it pay very little and use intrusive formats.
The fix is original content, not network shopping.

Before applying to any network:

1. Publish a real body of original writing (`content/articles/`).
2. Fill in `src/lib/site.js` so the legal pages are complete.
3. Make sure images are yours or properly licensed — see below.

### Image rights

**Writing your own article around someone else's photo does not license the
photo.** Running ads makes a fair-use argument weaker, not stronger, and Getty
and the wire agencies actively pursue this. Safe sources, in rough order of
practicality:

| Source | Cost | Watch out for |
|---|---|---|
| Your own photography | free | Arena media policies for pitch-side access |
| **Unsplash / Pexels / Pixabay** | free | Rarely has real game action |
| **Wikimedia Commons** | free | Check each file's licence; most need attribution, some need ShareAlike |
| **Flickr — filtered to CC** | free | Filter by licence explicitly; attribute exactly as the page states |
| League/club **press portals** | free | Usually editorial use only; read the terms |
| Getty / AP / Imagn / Reuters | paid | The only fully safe route for real game action |

Never use: broadcast screenshots, frames from YouTube, images pulled from
Google Images, other sites' photos, or AI-generated pictures of real players.

Always fill `imageCredit`. Both editors require it whenever an image is set.

Related exposure: team crests and player headshots are currently hotlinked from
league CDNs. Fine for a hobby site; riskier once ads are running.

## Before you publish

Fill in `src/lib/site.js` — the legal entity, address, contact emails,
jurisdiction and domain. Every placeholder still unfilled renders a **visible
warning at the top of each legal page**, so nothing ships as "TODO" by accident.

`/privacy`, `/terms` and `/contact` read entirely from that one file.

### Consent

`src/lib/consent.js` is the single gate for anything that sets a cookie.
Nothing optional loads until the reader consents — not blocked after the fact,
never requested. "Reject all" carries the same visual weight as "Accept all",
which regulators require and dark patterns violate.

**For EEA/UK traffic with Google ads you still need a Google-certified CMP**
from their published list. This module is a correct consent gate and is fine
elsewhere, but it is not on that list — wire a certified CMP to call
`setConsent()` here.

### Ads

`src/components/AdSlot.jsx` is network-agnostic (AdSense, Media.net, Ezoic).
Slots render **nothing at all** until `SITE.adNetwork` and `SITE.adsensePublisherId`
are both set *and* the reader has consented, so the site never ships empty ad
frames while you are still applying.

### Live-score refresh

Scores poll on a visible cadence:

- **every 30s** while a game is in progress
- **every 2m** otherwise
- **paused** whenever the browser tab is hidden, and refreshed immediately on
  return

The scoreboard shows "Updated Ns ago" with a manual refresh button. Background
refreshes never show a spinner, and a failed refresh keeps the last good data
on screen rather than blanking it.

## Refreshing the scraped leagues

```bash
npm run data              # every snapshot league
npm run data:bleague      # or one at a time
npm run data:kbl
npm run data:pba
node scripts/fetch-data.mjs cba
node scripts/fetch-data.mjs tpbl
```

If a source is unreachable the script **leaves the existing snapshot alone** and
reports the failure. A bad run can never replace real data with invented data.

### Translation

Korean and Japanese sources are converted to English during the scrape, using
each league's own published English club names. B.League roster entries written
in katakana are romanized; Japanese players' kanji names keep their original
form, because romanizing kanji without a name dictionary would be guessing.

## Player statistics

CBA, KBL and TPBL now carry full per-player season averages, which also fill
their rosters.

- **TPBL** uses the league's own API (`api.tpbl.basketball`) — first-party,
  CORS-open, with English names in `meta.alt_name`. The best source in the
  project.
- **CBA and KBL** come from RealGM's international section. Its robots.txt has
  no Disallow rules and asks only for `crawl-delay: 2`, which
  `scripts/player-stats.mjs` honours. Cloudflare there rejects Node's `fetch`
  on TLS fingerprint while serving curl normally, so those requests shell out
  to curl. If RealGM ever returns an actual challenge page, the parser treats
  it as a failure and gives up rather than working around it.

Two traps worth knowing, both of which produced wrong data before being fixed:

- **Never match clubs by abbreviation.** RealGM's `SON` is Suwon KT Sonicboom,
  and fuzzy matching cheerfully assigned those players to Goyang *Sono*. The
  parser now reads the club link in the Team cell, which carries the full name.
- **TPBL clubs are mapped explicitly** in `TPBL_CLUBS`, because asia-basket's
  labels ("N.Taipei", "Taiwan B.") and the league's Chinese names share no
  text — and both "Kings" and "N.Taipei" are New Taipei clubs, so a near-miss
  would merge two different teams.

Leaders require a minimum share of games played, so a one-game cameo cannot
outrank a season-long leader.

## Known source limitations

These are real constraints, not bugs to fix in code:

- **`api.kbl.or.kr` is currently returning HTTP 500** to everyone, including
  KBL's own website (which is serving cached data). The scraper targets the
  real endpoints and retries; while the API is down, KBL falls back to its
  published English club list plus asia-basket's public fixture widget. Rerun
  `npm run data:kbl` once their API recovers to pick up standings and rosters.
- **`pba.ph` sits behind a Cloudflare bot check.** We do not attempt to defeat
  it. PBA teams and rosters come from Wikipedia's API instead, and PBA news
  from Philippine sports desks (Inquirer, Tiebreaker Times, GMA, PhilStar,
  Rappler).
- **asia-basket.com paywalls its standings and player stats** ("You see it
  because you are not a subscriber"). Only its public league table is used —
  which is enough for CBA and TPBL clubs, results and fixtures, since neither
  league has a public English API and ESPN carries neither.
- **CBA and TPBL club names are asia-basket's short forms** ("Fujian S.",
  "N.Taipei"). They are the source's own labels, left as-is rather than
  expanded by guesswork.
- **Taipei Times publishes a general news feed**, so TPBL news requires
  explicit basketball context. When there is none, the page shows nothing
  rather than Taiwanese politics.
- **ESPN's `/teams` endpoint is the one endpoint without CORS headers**, so club
  lists are built from the standings feed instead (`src/lib/espn.js`).
- **ESPN carries EuroLeague clubs but no EuroLeague games or standings**, which
  is why EuroLeague has its own adapter (`src/lib/euroleague.js`).
- **ESPN rejects date ranges for NCAA** unless a division group is given;
  `groups=50` (Division I) is set per-league in `src/lib/leagues.js`.

## Article links

News cards link to the original publisher and open **in the same tab**, on
purpose — so the browser's Back button returns the reader to Hoopspire. A
`target="_blank"` tab has no history, which makes Back dead on arrival.

Only headline, dek, byline and link are stored. The copy stays with its
publisher.

## Layout

```
src/
  lib/
    leagues.js      league registry — source, region, ESPN slug, params
    espn.js         ESPN adapter (live)
    euroleague.js   EuroLeague official-feed adapter (live)
    snapshot.js     reads public/data/*.json
    api.js          unified facade the pages call
    useAsync.js     loader hook with visibility-aware polling
    articles.js     loads and renders content/articles/*.md
  components/       Header, Ticker, ScoreCard, StandingsTable, ArticleCard…
  pages/            Home, League, Scores, Stats, Teams, Team, Game, About,
                    Originals, Story, Privacy, Terms, Contact
  lib/site.js       ⚠️ legal + ad config — fill this in before publishing
  lib/consent.js    the consent gate
content/
  articles/         your original writing (Markdown + frontmatter)
    _TEMPLATE.md    copy this to start a new piece
scripts/
  fetch-data.mjs    the snapshot builder
  cms-server.mjs    the local article editor
public/admin/       git-based CMS (Sveltia) for the deployed site
public/data/        scraped snapshots
```

## Design

Light cream `#F3EFE7`, ink `#1A1A1A`, crimson `#8A0000`, gold `#C89E56`,
parchment rules `#E2DCCF`. Instrument Serif for display, Hanken Grotesk for
body, JetBrains Mono for numbers and labels. Tokens live in `src/index.css`.

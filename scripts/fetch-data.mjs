/**
 * Snapshot builder for the leagues with no CORS-open public API.
 *
 *   node scripts/fetch-data.mjs            # all three
 *   node scripts/fetch-data.mjs kbl        # just one
 *
 * Writes /public/data/<LeagueKey>.json in the same normalised shape the ESPN
 * and EuroLeague adapters produce, so the UI treats every league identically.
 *
 * Rules this script follows:
 *   - Only real fetched values are written. If a source is unreachable the
 *     league's existing snapshot is left untouched and the failure is
 *     reported, so a bad run can never replace real data with invented data.
 *   - Korean and Japanese source pages are translated to English on the way
 *     in, using the leagues' own published English club names.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as cheerio from 'cheerio'
import { realgmPlayerStats, tpblPlayerStats, buildLeaders } from './player-stats.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, '..', 'public', 'data')

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Collapse whitespace and strip Wikipedia-style [1] footnote markers. */
const clean = (s) => (s || '').replace(/\[.*?\]/g, '').replace(/\s+/g, ' ').trim()

async function get(url, { json = false, retries = 3, headers = {} } = {}) {
  let lastErr
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, 'Accept-Language': 'en,ja;q=0.8,ko;q=0.8', ...headers },
      })
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status}`)
        err.status = res.status
        throw err
      }
      return json ? await res.json() : await res.text()
    } catch (err) {
      lastErr = err
      // Wikipedia and the league sites rate-limit; back off hard on a 429
      // rather than hammering them into a longer block.
      const wait = err.status === 429 ? 4000 * attempt : 600 * attempt
      if (attempt < retries) await sleep(wait)
    }
  }
  throw new Error(`${url} — ${lastErr.message}`)
}

// ───────────────────────────────────────────────────────────────────────────
// B.LEAGUE (Japan)
//
// bleague.jp is server-rendered HTML with no API. The club index is an SVG
// map, so club IDs come from its links and each club's own page supplies the
// name; the roster lives at /roster/?TeamID=<id>.
//
// Club names on the site are Japanese. B.League publishes official English
// names for all 26 B1 clubs — that mapping is applied here so the ledger reads
// in English, with the Japanese name kept alongside for reference.
// ───────────────────────────────────────────────────────────────────────────
const BLEAGUE_EN = {
  レバンガ北海道: 'Levanga Hokkaido',
  仙台８９ＥＲＳ: 'Sendai 89ers',
  仙台89ERS: 'Sendai 89ers',
  秋田ノーザンハピネッツ: 'Akita Northern Happinets',
  茨城ロボッツ: 'Ibaraki Robots',
  宇都宮ブレックス: 'Utsunomiya Brex',
  群馬クレインサンダーズ: 'Gunma Crane Thunders',
  越谷アルファーズ: 'Koshigaya Alphas',
  千葉ジェッツ: 'Chiba Jets',
  アルバルク東京: 'Alvark Tokyo',
  サンロッカーズ渋谷: 'SunRockers Shibuya',
  東京サンロッカーズ: 'SunRockers Shibuya',
  神戸ストークス: 'Kobe Storks',
  川崎ブレイブサンダース: 'Kawasaki Brave Thunders',
  横浜ビー・コルセアーズ: 'Yokohama B-Corsairs',
  新潟アルビレックスＢＢ: 'Niigata Albirex BB',
  新潟アルビレックスBB: 'Niigata Albirex BB',
  富山グラウジーズ: 'Toyama Grouses',
  信州ブレイブウォリアーズ: 'Shinshu Brave Warriors',
  三遠ネオフェニックス: 'San-en NeoPhoenix',
  シーホース三河: 'SeaHorses Mikawa',
  名古屋ダイヤモンドドルフィンズ: 'Nagoya Diamond Dolphins',
  ファイティングイーグルス名古屋: 'Fighting Eagles Nagoya',
  滋賀レイクス: 'Shiga Lakes',
  京都ハンナリーズ: 'Kyoto Hannaryz',
  大阪エヴェッサ: 'Osaka Evessa',
  島根スサノオマジック: 'Shimane Susanoo Magic',
  広島ドラゴンフライズ: 'Hiroshima Dragonflies',
  佐賀バルーナーズ: 'Saga Ballooners',
  長崎ヴェルカ: 'Nagasaki Velca',
  琉球ゴールデンキングス: 'Ryukyu Golden Kings',
  アルティーリ千葉: 'Altiri Chiba',
  ベルテックス静岡: 'Veltex Shizuoka',
}

/** Katakana → Latin, so Japanese roster entries read in English. */
const KANA = {
  キャ: 'kya', キュ: 'kyu', キョ: 'kyo', シャ: 'sha', シュ: 'shu', ショ: 'sho',
  チャ: 'cha', チュ: 'chu', チョ: 'cho', ニャ: 'nya', ニュ: 'nyu', ニョ: 'nyo',
  ヒャ: 'hya', ヒュ: 'hyu', ヒョ: 'hyo', ミャ: 'mya', ミュ: 'myu', ミョ: 'myo',
  リャ: 'rya', リュ: 'ryu', リョ: 'ryo', ギャ: 'gya', ギュ: 'gyu', ギョ: 'gyo',
  ジャ: 'ja', ジュ: 'ju', ジョ: 'jo', ビャ: 'bya', ビュ: 'byu', ビョ: 'byo',
  ピャ: 'pya', ピュ: 'pyu', ピョ: 'pyo', ヴァ: 'va', ヴィ: 'vi', ヴェ: 've',
  ヴォ: 'vo', ファ: 'fa', フィ: 'fi', フェ: 'fe', フォ: 'fo', ティ: 'ti',
  ディ: 'di', デュ: 'du', ウィ: 'wi', ウェ: 'we', ウォ: 'wo', ツァ: 'tsa',
  ツィ: 'tsi', ツェ: 'tse', ツォ: 'tso', シェ: 'she', ジェ: 'je', チェ: 'che',
  ア: 'a', イ: 'i', ウ: 'u', エ: 'e', オ: 'o',
  カ: 'ka', キ: 'ki', ク: 'ku', ケ: 'ke', コ: 'ko',
  サ: 'sa', シ: 'shi', ス: 'su', セ: 'se', ソ: 'so',
  タ: 'ta', チ: 'chi', ツ: 'tsu', テ: 'te', ト: 'to',
  ナ: 'na', ニ: 'ni', ヌ: 'nu', ネ: 'ne', ノ: 'no',
  ハ: 'ha', ヒ: 'hi', フ: 'fu', ヘ: 'he', ホ: 'ho',
  マ: 'ma', ミ: 'mi', ム: 'mu', メ: 'me', モ: 'mo',
  ヤ: 'ya', ユ: 'yu', ヨ: 'yo',
  ラ: 'ra', リ: 'ri', ル: 'ru', レ: 're', ロ: 'ro',
  ワ: 'wa', ヲ: 'o', ン: 'n',
  ガ: 'ga', ギ: 'gi', グ: 'gu', ゲ: 'ge', ゴ: 'go',
  ザ: 'za', ジ: 'ji', ズ: 'zu', ゼ: 'ze', ゾ: 'zo',
  ダ: 'da', ヂ: 'ji', ヅ: 'zu', デ: 'de', ド: 'do',
  バ: 'ba', ビ: 'bi', ブ: 'bu', ベ: 'be', ボ: 'bo',
  パ: 'pa', ピ: 'pi', プ: 'pu', ペ: 'pe', ポ: 'po',
  ヴ: 'vu', ー: '', ッ: '',
}

function romanizeKatakana(text) {
  if (!text) return ''
  let out = ''
  let i = 0
  let pendingDouble = false
  while (i < text.length) {
    const two = text.slice(i, i + 2)
    const one = text[i]
    let piece = null
    if (KANA[two] != null) {
      piece = KANA[two]
      i += 2
    } else if (KANA[one] != null) {
      if (one === 'ッ') {
        pendingDouble = true
        i += 1
        continue
      }
      piece = KANA[one]
      i += 1
    } else {
      out += one
      i += 1
      continue
    }
    if (pendingDouble && piece) {
      out += piece[0]
      pendingDouble = false
    }
    out += piece
  }
  return out
}

/** True when a string contains no CJK characters. */
const isLatin = (s) => !/[぀-ヿ㐀-鿿가-힯]/.test(s || '')

function titleCase(s) {
  return s
    .toLowerCase()
    .replace(/(^|[\s'.\-·])([a-z])/g, (_, p, c) => p + c.toUpperCase())
    .trim()
}

/**
 * Render a Japanese roster name in English.
 *
 * Foreign players are written in katakana and romanize cleanly. Japanese
 * players' names are kanji, which cannot be romanized reliably without a
 * dictionary — those keep their original form, which is the honest outcome.
 */
function englishPlayerName(raw) {
  const name = (raw || '').replace(/\s+/g, ' ').trim()
  if (!name) return { name: '', original: '' }
  if (isLatin(name)) return { name, original: name }

  const katakanaOnly = /^[゠-ヿ・\s.．]+$/.test(name)
  if (katakanaOnly) {
    const parts = name.split(/[・]/).map((p) => romanizeKatakana(p.trim())).filter(Boolean)
    if (parts.length) return { name: titleCase(parts.join(' ')), original: name }
  }
  return { name, original: name }
}

async function scrapeBLeague() {
  const notes = []
  const indexHtml = await get('https://www.bleague.jp/club/')
  const ids = [...new Set([...indexHtml.matchAll(/TeamID=(\d+)/g)].map((m) => m[1]))]
  if (!ids.length) throw new Error('no club IDs found on bleague.jp/club/')

  const teams = []
  const rosters = {}

  for (const id of ids) {
    try {
      const html = await get(`https://www.bleague.jp/club_detail/?TeamID=${id}&tab=1`)
      const $ = cheerio.load(html)
      const jp = ($('title').text().split('|')[0] || '').replace(/\s+/g, ' ').trim()
      if (!jp) continue

      const en = BLEAGUE_EN[jp] || null
      if (!en) notes.push(`No English name mapped for ${jp} (TeamID ${id})`)

      const logo =
        $('meta[property="og:image"]').attr('content') ||
        $('.club-logo img, .clubLogo img').first().attr('src') ||
        null

      teams.push({
        id,
        league: 'BLeague',
        name: en || jp,
        nameLocal: jp,
        shortName: en || jp,
        abbr: (en || jp).slice(0, 3).toUpperCase(),
        city: null,
        logo,
        url: `https://www.bleague.jp/club_detail/?TeamID=${id}`,
      })

      // Roster
      // NOTE: /roster/ ignores TeamID — `club` is the parameter that
      // actually filters. Passing TeamID silently returns an unfiltered,
      // 40-per-page slice of the whole league.
      const rHtml = await get(`https://www.bleague.jp/roster/?club=${id}`)
      const $$ = cheerio.load(rHtml)
      const players = []
      $$('a[href*="roster_detail"]').each((_, el) => {
        const text = $$(el).text().replace(/\s+/g, ' ').trim()
        if (!text) return
        // "D.J・ニュービル ポジション：PG/SG #2"
        const jersey = (text.match(/#\s*([0-9]{1,2})/) || [])[1] || null
        const position = (text.match(/ポジション[：:]\s*([A-Z/]+)/) || [])[1] || null
        const rawName = text.split(/ポジション/)[0].trim()
        if (!rawName) return
        const { name, original } = englishPlayerName(rawName)
        const pid = (($$(el).attr('href') || '').match(/PlayerID=(\d+)/) || [])[1] || null
        if (players.some((p) => p.id === pid)) return
        players.push({
          id: pid,
          name,
          nameLocal: original !== name ? original : null,
          jersey,
          position,
          height: null,
          weight: null,
          age: null,
          country: null,
          headshot: $$(el).find('img').attr('src') || null,
        })
      })
      players.sort((a, b) => Number(a.jersey ?? 999) - Number(b.jersey ?? 999))

      // A B1 squad is ~12-18. Anything near the page size means the filter
      // silently failed and we would be storing other clubs' players.
      if (players.length > 25) {
        notes.push(`TeamID ${id}: roster filter looks broken (${players.length} players) — skipped`)
      } else if (players.length) {
        rosters[id] = players
      }

      process.stdout.write(`  B.League ${teams.length}/${ids.length} ${en || jp} (${players.length} players)\n`)
      await sleep(350)
    } catch (err) {
      notes.push(`TeamID ${id}: ${err.message}`)
    }
  }

  if (!teams.length) throw new Error('no B.League teams parsed')

  const fixtures = await asiaBasketFixtures('BLeague', teams)
  notes.push(...fixtures.notes)

  const news = await fetchLeagueNews('BLeague', NEWS_FEEDS.BLeague, NEWS_TERMS.BLeague)
  notes.push(...news.notes)

  return {
    league: 'BLeague',
    season: String(new Date().getFullYear()),
    fetchedAt: new Date().toISOString(),
    sources: [
      { name: 'bleague.jp', url: 'https://www.bleague.jp' },
      { name: 'asia-basket', url: 'https://www.asia-basket.com/Japan/basketball.aspx' },
      ...NEWS_FEEDS.BLeague.map((x) => ({ name: x.name, url: x.url })),
    ],
    notes,
    teams,
    rosters,
    standings: { seasonLabel: '', rows: [] },
    games: fixtures.games,
    news: news.articles,
    leaders: {},
  }
}

// ───────────────────────────────────────────────────────────────────────────
// asia-basket.com — upcoming fixtures for the Asian leagues.
//
// asia-basket puts its standings and player stats behind a subscription
// ("You see it because you are not a subscriber"), so none of that is taken.
// The fixture widget on each league page is public, and it is genuinely
// useful: real dates with the clubs already named in English.
//
// Club names there are abbreviated ("Alvark To.", "Sunrock."), so each side
// is matched back to the full club record we scraped from the league itself.
// ───────────────────────────────────────────────────────────────────────────
const ASIA_BASKET = {
  KBL: 'https://www.asia-basket.com/South-Korea/basketball-League-KBL.aspx',
  BLeague: 'https://www.asia-basket.com/Japan/basketball-League-B-League.aspx',
}

/** Loose token match: "Alvark To." → "Alvark Tokyo". */
function matchTeam(label, teams) {
  const norm = (x) => (x || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
  const target = norm(label)
  if (!target) return null

  let best = null
  let bestScore = 0
  for (const t of teams) {
    const name = norm(t.name)
    let score = 0
    for (const token of target.split(' ')) {
      if (token.length < 2) continue
      if (name.includes(token)) score += token.length
      else if (name.split(' ').some((w) => w.startsWith(token))) score += token.length - 1
    }
    if (score > bestScore) {
      bestScore = score
      best = t
    }
  }
  return bestScore >= 3 ? best : null
}

/** "Oct.4" → an ISO date, rolling to next year when the month has passed. */
function asiaBasketDate(label) {
  const m = clean(label).match(/([A-Za-z]{3})\.?\s*(\d{1,2})/)
  if (!m) return null
  const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
  const mi = months.indexOf(m[1].slice(0, 3).toLowerCase())
  if (mi < 0) return null

  const now = new Date()
  let year = now.getFullYear()
  // A month more than three back is next season's fixture, not last year's.
  if (mi < now.getMonth() - 3) year += 1
  return new Date(Date.UTC(year, mi, Number(m[2]), 10, 0, 0)).toISOString()
}

async function asiaBasketFixtures(leagueKey, teams) {
  const url = ASIA_BASKET[leagueKey]
  if (!url) return { games: [], notes: [] }

  const notes = []
  try {
    const html = await get(url, { retries: 2 })
    const $ = cheerio.load(html)
    const rows = $('table').first().find('tr')
    const games = []

    rows.each((_, tr) => {
      const cells = $(tr).find('td,th').map((__, c) => clean($(c).text())).get()
      if (cells.length < 3) return
      const [homeLabel, dateLabel, awayLabel] = cells
      const date = asiaBasketDate(dateLabel)
      if (!date) return

      const home = matchTeam(homeLabel, teams)
      const away = matchTeam(awayLabel, teams)
      if (!home || !away || home.id === away.id) {
        notes.push(`fixture unmatched: "${homeLabel}" vs "${awayLabel}"`)
        return
      }

      games.push({
        id: `ab-${leagueKey}-${date.slice(0, 10)}-${home.id}-${away.id}`,
        league: leagueKey,
        status: 'scheduled',
        statusDetail: 'Scheduled',
        period: null,
        clock: null,
        date,
        venue: null,
        city: null,
        home: { id: home.id, name: home.name, abbr: home.abbr, logo: home.logo, score: null, linescores: [], leaders: [] },
        away: { id: away.id, name: away.name, abbr: away.abbr, logo: away.logo, score: null, linescores: [], leaders: [] },
      })
    })

    return { games, notes }
  } catch (err) {
    return { games: [], notes: [`asia-basket ${leagueKey}: ${err.message}`] }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// CBA (China) and TPBL (Taiwan)
//
// Neither league has a public English API, and ESPN carries neither. Their
// asia-basket league pages, however, publish a full public results table —
// date, home, score, away — which is enough to build the clubs, the results
// and the fixtures from a single real source.
//
// The table carries no years, so the year is walked backwards from today: the
// list runs newest-first, and each time the month jumps forward as we descend
// we have crossed a season boundary.
// ───────────────────────────────────────────────────────────────────────────
/**
 * TPBL clubs.
 *
 * Two sources name the same seven clubs differently: asia-basket's results
 * table uses short labels ("Taiwan B.", "N.Taipei"), while the league's own
 * API returns Chinese names. Fuzzy matching cannot bridge that — and both
 * "Kings" and "N.Taipei" are New Taipei clubs, so a near-miss would silently
 * merge two different teams.
 *
 * So the mapping is written out explicitly, keyed by the asia-basket label
 * and checked against the league's own club list (api.tpbl.basketball,
 * /events/2/teams). Seven labels, seven clubs, one-to-one.
 */
const TPBL_CLUBS = {
  Dreamers: { id: 3, name: 'Formosa Dreamers', local: '福爾摩沙夢想家' },
  Kaohsiung: { id: 2, name: 'Kaohsiung Aquas', local: '高雄全家海神' },
  Kings: { id: 7, name: 'New Taipei Kings', local: '新北國王' },
  'N.Taipei': { id: 6, name: 'New Taipei CTBC DEA', local: '新北中信特攻' },
  Lioneers: { id: 4, name: 'Hsinchu Lioneers', local: '新竹御嵿攻城獅' },
  'Taipei TM': { id: 8, name: 'Taipei Taishin Mars', local: '臺北台新戰神' },
  'Taiwan B.': { id: 5, name: 'Taiwan Beer Leopards', local: '桃園台啤永豐雲豹' },
}

/** Canonical club record for a TPBL side, from either source's label. */
function tpblClub(label) {
  const direct = TPBL_CLUBS[clean(label)]
  if (direct) return direct
  const byLocal = Object.values(TPBL_CLUBS).find((c) => c.local === clean(label))
  if (byLocal) return byLocal
  const lower = clean(label).toLowerCase()
  return Object.values(TPBL_CLUBS).find((c) => c.name.toLowerCase().includes(lower)) || null
}

const ASIA_BASKET_LEAGUES = {
  CBA: {
    url: 'https://www.asia-basket.com/China/basketball-League-CBA.aspx',
    site: 'https://www.asia-basket.com/China/basketball.aspx',
  },
  TPBL: {
    url: 'https://www.asia-basket.com/Taiwan/basketball-League-TPBL.aspx',
    site: 'https://www.asia-basket.com/Taiwan/basketball.aspx',
  },
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function monthDay(label) {
  const m = clean(label).match(/([A-Za-z]{3})[.\s]*(\d{1,2})/)
  if (!m) return null
  const mi = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase())
  return mi < 0 ? null : { month: mi, day: Number(m[2]) }
}

const slug = (name) => clean(name).replace(/\W+/g, '-').toLowerCase()

/**
 * Parse an asia-basket league page into clubs, results and fixtures.
 *
 * Two row shapes appear: results as [date, home, "H-A", away] and upcoming
 * fixtures as [home, date, away].
 */
async function scrapeAsiaBasketLeague(leagueKey, limit = 60) {
  const cfg = ASIA_BASKET_LEAGUES[leagueKey]
  const notes = []
  const html = await get(cfg.url, { retries: 3 })
  const $ = cheerio.load(html)

  const rows = $('table').first().find('tr').toArray()
  if (!rows.length) throw new Error(`no fixture table on ${cfg.url}`)

  const teams = new Map()
  const games = []

  const now = new Date()
  let year = now.getFullYear()
  let prevMonth = now.getMonth()

  for (const tr of rows.slice(0, limit)) {
    const cells = $(tr).find('td,th').map((_, c) => clean($(c).text())).get().filter(Boolean)
    if (cells.length < 3) continue

    const scoreIdx = cells.findIndex((c) => /^\d{1,3}\s*-\s*\d{1,3}$/.test(c))
    const played = scoreIdx > 0

    let dateLabel, homeName, awayName, homeScore = null, awayScore = null
    if (played) {
      dateLabel = cells[0]
      homeName = cells[scoreIdx - 1]
      awayName = cells[scoreIdx + 1]
      const [h, a] = cells[scoreIdx].split('-').map((n) => Number(n.trim()))
      homeScore = h
      awayScore = a
    } else {
      // Upcoming: the date sits between the two clubs.
      const dateIdx = cells.findIndex((c) => monthDay(c))
      if (dateIdx < 1 || dateIdx >= cells.length - 1) continue
      dateLabel = cells[dateIdx]
      homeName = cells[dateIdx - 1]
      awayName = cells[dateIdx + 1]
    }

    const md = monthDay(dateLabel)
    if (!md || !homeName || !awayName || homeName === awayName) continue

    // Rows descend newest-first; a month jumping forward means a year earlier.
    if (md.month > prevMonth) year -= 1
    prevMonth = md.month
    const date = new Date(Date.UTC(year, md.month, md.day, 11, 0, 0)).toISOString()

    // TPBL labels resolve through the explicit club table so both sources
    // land on the same seven clubs; other leagues use the label as given.
    const canon = (label) => {
      if (leagueKey !== 'TPBL') return { id: slug(label), name: label, local: null }
      const c = tpblClub(label)
      if (!c) {
        notes.push(`unmapped TPBL club label: "${label}"`)
        return { id: slug(label), name: label, local: null }
      }
      return { id: String(c.id), name: c.name, local: c.local }
    }

    const homeClub = canon(homeName)
    const awayClub = canon(awayName)

    for (const club of [homeClub, awayClub]) {
      if (!teams.has(club.id)) {
        teams.set(club.id, {
          id: club.id,
          league: leagueKey,
          name: club.name,
          nameLocal: club.local,
          shortName: club.name,
          abbr: club.name.slice(0, 3).toUpperCase(),
          logo: null,
        })
      }
    }

    const side = (club, score) => ({
      id: club.id,
      name: club.name,
      abbr: club.name.slice(0, 3).toUpperCase(),
      logo: null,
      score,
      linescores: [],
      leaders: [],
    })

    games.push({
      id: `ab-${leagueKey}-${date.slice(0, 10)}-${homeClub.id}-${awayClub.id}`,
      league: leagueKey,
      status: played ? 'final' : 'scheduled',
      statusDetail: played ? 'Final' : 'Scheduled',
      period: null,
      clock: null,
      date,
      venue: null,
      city: null,
      home: side(homeClub, homeScore),
      away: side(awayClub, awayScore),
    })
  }

  if (!teams.size) throw new Error(`no clubs parsed from ${cfg.url}`)
  notes.push(
    'Clubs, results and fixtures parsed from the public asia-basket league ' +
      'table; its standings and player stats are subscriber-only and unused.'
  )

  const news = NEWS_FEEDS[leagueKey]
    ? await fetchLeagueNews(leagueKey, NEWS_FEEDS[leagueKey], NEWS_TERMS[leagueKey])
    : { articles: [], notes: [] }
  notes.push(...news.notes)

  // Player statistics. TPBL publishes its own; CBA comes from RealGM.
  let players = []
  let rosters = {}
  let leaders = {}
  let statsTeams = []

  try {
    if (leagueKey === 'TPBL') {
      const s = await tpblPlayerStats()
      players = s.players
      rosters = s.rosters
      statsTeams = s.teams
      notes.push(...s.notes)
    } else {
      const s = await realgmPlayerStats(leagueKey)
      players = s.players
      notes.push(...s.notes)
      if (players.length) {
        // RealGM identifies clubs by abbreviation; match them back to the
        // clubs parsed from the results table so rosters land on real teams.
        for (const p of players) {
          const club = matchTeam(p.teamName || p.teamAbbr, [...teams.values()])
          if (!club) continue
          p.teamId = club.id
          ;(rosters[club.id] ||= []).push({
            id: `${club.id}-${p.name}`.replace(/\W+/g, '-').toLowerCase(),
            name: p.name,
            jersey: null,
            position: null,
            height: null,
            weight: null,
            age: null,
            country: null,
            headshot: null,
          })
        }
        const unmatched = players.filter((p) => !p.teamId).length
        if (unmatched) notes.push(`${unmatched} players could not be matched to a club`)
      }
    }

    const built = buildLeaders(players)
    leaders = built.leaders || {}
    if (built.minGames) notes.push(`Leaders require at least ${built.minGames} games played.`)
  } catch (err) {
    notes.push(`player stats: ${err.message}`)
  }

  // TPBL's own API is a better club source than the results table: it has the
  // full English names and real crests. But the games already reference the
  // ids parsed from asia-basket ("dreamers"), so merge the richer record onto
  // the existing club rather than adding a second copy of it — otherwise the
  // league ends up with fourteen teams instead of seven.
  if (statsTeams.length) {
    for (const t of statsTeams) {
      // TPBL ids are the league's own, so they line up exactly; other leagues
      // still need a name match.
      const existing = teams.get(t.id) || matchTeam(t.name, [...teams.values()])
      if (existing) {
        // Keep the canonical club name we already resolved — the API's
        // `alt_name` is a short handle ("Aquas", "Dea"), not a full name —
        // but take its crest, which is the real thing.
        teams.set(existing.id, {
          ...existing,
          name: existing.name || t.name,
          nameLocal: existing.nameLocal ?? t.nameLocal ?? null,
          shortName: t.name || existing.shortName,
          logo: t.logo || existing.logo,
        })
        // Move any roster captured under the API's id onto the club's real id.
        if (t.id !== existing.id && rosters[t.id]) {
          rosters[existing.id] = rosters[t.id]
          delete rosters[t.id]
          for (const p of players) if (p.teamId === t.id) p.teamId = existing.id
        }
      } else {
        teams.set(t.id, { ...teams.get(t.id), ...t })
      }
    }
  }

  return {
    league: leagueKey,
    season: String(year),
    fetchedAt: new Date().toISOString(),
    sources: [
      { name: 'asia-basket', url: cfg.site },
      ...(NEWS_FEEDS[leagueKey] || []).map((x) => ({ name: x.name, url: x.url })),
    ],
    notes,
    teams: [...teams.values()].sort((a, b) => a.name.localeCompare(b.name)),
    rosters,
    playerStats: players,
    standings: { seasonLabel: '', rows: [] },
    games,
    news: news.articles,
    leaders,
  }
}

const scrapeCBA = () => scrapeAsiaBasketLeague('CBA')
const scrapeTPBL = () => scrapeAsiaBasketLeague('TPBL')

// ───────────────────────────────────────────────────────────────────────────
// KBL (South Korea)
//
// kbl.or.kr is a SPA backed by api.kbl.or.kr — a clean JSON API discovered by
// capturing the site's own network traffic. It is CORS-open but intermittently
// returns 500, so every call is retried and a failed run leaves the previous
// snapshot in place.
// ───────────────────────────────────────────────────────────────────────────
const KBL_API = 'https://api.kbl.or.kr'

const KBL_EN = {
  서울SK나이츠: 'Seoul SK Knights',
  서울삼성썬더스: 'Seoul Samsung Thunders',
  원주DB프로미: 'Wonju DB Promy',
  안양정관장: 'Anyang Jung Kwan Jang',
  창원LG세이커스: 'Changwon LG Sakers',
  부산KCC이지스: 'Busan KCC Egis',
  대구한국가스공사: 'Daegu Korea Gas Corporation',
  고양소노스카이거너스: 'Goyang Sono Skygunners',
  울산현대모비스피버스: 'Ulsan Hyundai Mobis Phoebus',
  수원KT소닉붐: 'Suwon KT Sonicboom',
}

const kblEnglish = (name) => {
  const key = (name || '').replace(/\s+/g, '')
  return KBL_EN[key] || name
}

async function kblGet(pathname) {
  const body = await get(`${KBL_API}${pathname}`, { json: true, retries: 4 })
  if (body?.resultCode && body.resultCode !== 'Success') {
    throw new Error(body.message || 'KBL API error')
  }
  return body?.object ?? body?.data ?? body
}

async function scrapeKBL() {
  const notes = []
  const teams = []
  const rosters = {}
  let standings = { seasonLabel: '', rows: [] }
  let games = []

  // Standings double as the club list.
  try {
    const rank = await kblGet('/league/rank/team?')
    const list = Array.isArray(rank) ? rank : rank?.list || []
    for (const r of list) {
      const local = r.teamName || r.teamNameFull || ''
      const name = kblEnglish(local)
      const id = r.teamCode || r.tcode || name
      teams.push({
        id,
        league: 'KBL',
        name,
        nameLocal: local || null,
        shortName: name,
        abbr: String(id).toUpperCase(),
        city: null,
        logo: r.teamLogo || r.logoImg || null,
      })
      standings.rows.push({
        team: { id, name, abbr: String(id).toUpperCase(), logo: r.teamLogo || null },
        wins: Number(r.winCnt ?? r.win ?? 0),
        losses: Number(r.loseCnt ?? r.lose ?? 0),
        pct: r.winRate != null ? String(r.winRate) : '—',
        pointsFor: r.scoreAvg != null ? Number(r.scoreAvg) : null,
        pointsAgainst: r.lossScoreAvg != null ? Number(r.lossScoreAvg) : null,
        diff: null,
        streak: null,
        seed: Number(r.rank ?? 0) || null,
      })
    }
  } catch (err) {
    notes.push(`standings/teams: ${err.message}`)
  }

  // Recent and upcoming fixtures, a month either side of today.
  try {
    const d = (offset) => {
      const x = new Date()
      x.setDate(x.getDate() + offset)
      return x.toISOString().slice(0, 10).replace(/-/g, '')
    }
    const raw = await kblGet(`/match/list?fromDate=${d(-30)}&toDate=${d(30)}&tcodeList=all`)
    const list = Array.isArray(raw) ? raw : raw?.list || []
    games = list.map((g) => {
      const homeName = kblEnglish(g.homeTeamName)
      const awayName = kblEnglish(g.awayTeamName)
      const played = g.homeScore != null && Number(g.homeScore) > 0
      return {
        id: g.gameSq ?? g.gameCode ?? `${g.gameDate}-${g.homeTeamCode}`,
        league: 'KBL',
        status: g.gameStatus === 'L' ? 'live' : played ? 'final' : 'scheduled',
        statusDetail: played ? 'Final' : 'Scheduled',
        period: null,
        clock: null,
        date: g.gameDate
          ? `${String(g.gameDate).slice(0, 4)}-${String(g.gameDate).slice(4, 6)}-${String(g.gameDate).slice(6, 8)}T${(g.gameTime || '1900').slice(0, 2)}:${(g.gameTime || '1900').slice(2, 4)}:00+09:00`
          : null,
        venue: g.gymName || null,
        city: null,
        home: {
          id: g.homeTeamCode,
          name: homeName,
          abbr: String(g.homeTeamCode || '').toUpperCase(),
          logo: null,
          score: g.homeScore != null ? Number(g.homeScore) : null,
          linescores: [],
          leaders: [],
        },
        away: {
          id: g.awayTeamCode,
          name: awayName,
          abbr: String(g.awayTeamCode || '').toUpperCase(),
          logo: null,
          score: g.awayScore != null ? Number(g.awayScore) : null,
          linescores: [],
          leaders: [],
        },
      }
    })
  } catch (err) {
    notes.push(`fixtures: ${err.message}`)
  }

  // Rosters, one call per club.
  for (const t of teams) {
    try {
      const raw = await kblGet(`/player/list?teamCode=${t.id}`)
      const list = Array.isArray(raw) ? raw : raw?.list || []
      const players = list.map((p) => ({
        id: p.playerSq ?? p.playerNo,
        name: p.playerNameEn || p.playerName,
        nameLocal: p.playerName || null,
        jersey: p.backNo != null ? String(p.backNo) : null,
        position: p.positionName || p.position || null,
        height: p.height ? `${p.height} cm` : null,
        weight: p.weight ? `${p.weight} kg` : null,
        age: null,
        country: null,
        headshot: p.playerImg || null,
      }))
      if (players.length) rosters[t.id] = players
      await sleep(250)
    } catch (err) {
      notes.push(`roster ${t.name}: ${err.message}`)
    }
  }

  // The official API is frequently down. When it is, fall back to the club
  // list KBL itself publishes in English plus asia-basket's public fixtures,
  // so the league still has real teams and real dates rather than nothing.
  if (!teams.length) {
    notes.push('api.kbl.or.kr unavailable — clubs from KBL English names, fixtures from asia-basket')
    for (const [local, name] of Object.entries(KBL_EN)) {
      teams.push({
        id: name.replace(/\W+/g, '-').toLowerCase(),
        league: 'KBL',
        name,
        nameLocal: local,
        shortName: name,
        abbr: name.split(/\s+/).map((w) => w[0]).join('').slice(0, 4).toUpperCase(),
        city: null,
        logo: null,
      })
    }
  }

  const fixtures = await asiaBasketFixtures('KBL', teams)
  notes.push(...fixtures.notes)
  if (!games.length) games = fixtures.games

  const news = await fetchLeagueNews('KBL', NEWS_FEEDS.KBL, NEWS_TERMS.KBL)
  notes.push(...news.notes)

  // Player statistics. KBL's own API has been down for the duration of this
  // build, so averages come from RealGM, which publishes the full KBL table.
  let playerStats = []
  let leaders = {}
  try {
    const s = await realgmPlayerStats('KBL')
    playerStats = s.players
    notes.push(...s.notes)

    for (const p of playerStats) {
      const club = matchTeam(p.teamName || p.teamAbbr, teams)
      if (!club) continue
      p.teamId = club.id
      ;(rosters[club.id] ||= []).push({
        id: `${club.id}-${p.name}`.replace(/\W+/g, '-').toLowerCase(),
        name: p.name,
        jersey: null,
        position: null,
        height: null,
        weight: null,
        age: null,
        country: null,
        headshot: null,
      })
    }
    const unmatched = playerStats.filter((p) => !p.teamId).length
    if (unmatched) notes.push(`${unmatched} KBL players could not be matched to a club`)

    const built = buildLeaders(playerStats)
    leaders = built.leaders || {}
    if (built.minGames) notes.push(`Leaders require at least ${built.minGames} games played.`)
  } catch (err) {
    notes.push(`player stats: ${err.message}`)
  }

  if (!teams.length && !games.length) {
    throw new Error(`no KBL data available — ${notes.join('; ')}`)
  }

  return {
    league: 'KBL',
    season: String(new Date().getFullYear()),
    fetchedAt: new Date().toISOString(),
    sources: [
      { name: 'kbl.or.kr', url: 'https://www.kbl.or.kr' },
      { name: 'asia-basket', url: 'https://www.asia-basket.com/South-Korea/basketball.aspx' },
      ...NEWS_FEEDS.KBL.map((x) => ({ name: x.name, url: x.url })),
    ],
    notes,
    teams,
    rosters,
    playerStats,
    standings,
    games,
    news: news.articles,
    leaders,
  }
}

// ───────────────────────────────────────────────────────────────────────────
// PBA (Philippines)
//
// pba.ph sits behind a Cloudflare bot check that a script cannot pass (and
// that we will not try to defeat). So the PBA snapshot is built from
// Wikipedia's API instead — CORS-open, real, actively maintained, and
// attributable. pba.ph is still attempted first in case the challenge is
// down, so the better source wins whenever it is available.
// ───────────────────────────────────────────────────────────────────────────
const WIKI = 'https://en.wikipedia.org/w/api.php?action=parse&format=json&prop=text&page='

async function wikiPage(title) {
  const body = await get(WIKI + encodeURIComponent(title), { json: true, retries: 5 })
  const html = body?.parse?.text?.['*']
  if (!html) throw new Error(`no Wikipedia content for "${title}"`)
  return cheerio.load(html)
}

/** "6 ft 7 in (2.01 m)" → "6' 7\"" to match the rest of the ledger. */
function tidyHeight(raw) {
  const m = clean(raw).match(/(\d+)\s*ft\s*(\d+)?/i)
  return m ? `${m[1]}' ${m[2] || 0}"` : clean(raw) || null
}

function tidyWeight(raw) {
  const m = clean(raw).match(/(\d+)\s*lb/i)
  return m ? `${m[1]} lbs` : clean(raw) || null
}

function ageFrom(dob) {
  const m = clean(dob).match(/(\d{4})[–-](\d{2})[–-](\d{2})/)
  if (!m) return null
  const born = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const age = Math.floor((Date.now() - born.getTime()) / 31557600000)
  return age > 15 && age < 60 ? age : null
}

async function pbaRosterFromWikipedia($, teamName) {
  let table = null
  $('table').each((_, tb) => {
    if (table) return
    const heads = $(tb).find('tr').first().find('th').map((__, x) => clean($(x).text())).get()
    if (heads.includes('Pos.') && heads.some((h) => /^Name$/i.test(h))) table = { tb, heads }
  })
  if (!table) return []

  const at = (re) => table.heads.findIndex((h) => new RegExp(re, 'i').test(h))
  const iPos = at('^Pos'), iNo = at('^#$'), iName = at('^Name$')
  const iHt = at('^Height'), iWt = at('^Weight'), iDob = at('^DOB'), iFrom = at('^From')
  if (iName < 0) return []

  const players = []
  $(table.tb).find('tr').slice(1).each((_, tr) => {
    const cells = $(tr).find('td,th').map((__, x) => clean($(x).text())).get()
    if (cells.length < 5) return
    const name = cells[iName]
    if (!name || /^Head coach|^Assistant/i.test(name)) return
    players.push({
      id: `${teamName}-${name}`.replace(/\W+/g, '-').toLowerCase(),
      name,
      jersey: iNo >= 0 ? cells[iNo] || null : null,
      position: iPos >= 0 ? cells[iPos] || null : null,
      height: iHt >= 0 ? tidyHeight(cells[iHt]) : null,
      weight: iWt >= 0 ? tidyWeight(cells[iWt]) : null,
      age: iDob >= 0 ? ageFrom(cells[iDob]) : null,
      country: null,
      college: iFrom >= 0 ? cells[iFrom] || null : null,
      headshot: null,
    })
  })
  return players
}

/**
 * PBA news, from Philippine sports desks.
 *
 * The PBA publishes no usable feed of its own, so coverage is aggregated from
 * the outlets that actually cover the league. Only headline, dek, byline and
 * link are stored — the copy stays with its publisher and every card links
 * out to the original story.
 *
 * These are RSS endpoints, which browsers cannot read cross-origin, so they
 * are fetched here at snapshot time rather than in the page.
 */
const NEWS_FEEDS = {
  BLeague: [
    { name: 'Japan Times', url: 'https://www.japantimes.co.jp/sports/feed/' },
    { name: 'Inquirer Sports', url: 'https://sports.inquirer.net/feed' },
  ],
  CBA: [{ name: 'South China Morning Post', url: 'https://www.scmp.com/rss/95/feed' }],
  TPBL: [{ name: 'Taipei Times', url: 'https://www.taipeitimes.com/xml/index.rss' }],
  KBL: [
    { name: 'Yonhap News', url: 'https://en.yna.co.kr/RSS/sports.xml' },
    {
      name: 'Chosun',
      url: 'https://www.chosun.com/arc/outboundfeeds/rss/category/sports/?outputType=xml',
    },
  ],
}

/** Club and league terms that mark a story as belonging to each league. */
const NEWS_TERMS = {
  BLeague: /B\.?League|Bリーグ|Chiba Jets|Ryukyu|Alvark|Utsunomiya|Brex|Levanga|Hokkaido|SeaHorses|Hannaryz|Evessa|Susanoo|Dragonflies|Grouses|NeoPhoenix|Diamond Dolphins|Brave Thunders|Crane Thunders|Northern Happinets|B-Corsairs|SunRockers|Velca|Ballooners|Albirex|Brave Warriors|89ers|Robots|Storks|Altiri|Shiga Lakes/i,
  CBA: /\bCBA\b|Chinese Basketball Association|Chinese basketball|Guangdong|Liaoning|Zhejiang|Xinjiang|Shanghai Sharks|Beijing Ducks|Guangsha|Shandong|Shenzhen|Yao Ming|basketball/i,
  // Taipei Times runs a general news feed, so "Taiwan" alone pulls in politics.
  // Every alternate here has to carry basketball context of its own.
  TPBL: /\bTPBL\b|P\. ?League|T1 League|(?:Taiwan|Taiwanese|Chinese Taipei)[^.]{0,60}basketball|basketball[^.]{0,60}(?:Taiwan|Taiwanese|Chinese Taipei)|Formosa Dreamers|Hsinchu Lioneers|Taipei Fubon Braves|Kaohsiung Steelers|New Taipei Kings|Taoyuan Pilots/i,
  KBL: /\bKBL\b|Korean Basketball League|basketball|SK Knights|Samsung Thunders|DB Promy|Jung Kwan Jang|LG Sakers|KCC Egis|Sono Skygunners|Hyundai Mobis|KT Sonicboom|Korea Gas/i,
}

const PBA_FEEDS = [
  { name: 'Inquirer Sports', url: 'https://sports.inquirer.net/feed' },
  { name: 'Tiebreaker Times', url: 'https://www.tiebreakertimes.com.ph/feed' },
  { name: 'GMA News', url: 'https://data.gmanetwork.com/gno/rss/sports/basketball/feed.xml' },
  { name: 'PhilStar', url: 'https://www.philstar.com/rss/sports' },
  { name: 'Rappler', url: 'https://www.rappler.com/sports/feed/' },
]

/** Headlines that mention the league, a club, or a club's nickname. */
const PBA_TERMS =
  /\bPBA\b|Ginebra|San Miguel|Beermen|Magnolia|Hotshots|Meralco|Bolts|NLEX|Road Warriors|TNT Tropang|Rain or Shine|Elasto|Blackwater|Bossing|Converge|FiberXers|Phoenix Super|Fuel Masters|Terrafirma|Dyip|Titan Ultra|Gilas/i

const ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
  mdash: '—',
  ndash: '–',
  hellip: '…',
}

function decodeEntities(text) {
  return String(text || '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
}

/**
 * Strip markup and decode entities from an RSS field.
 *
 * Decoded twice on purpose: several of these feeds ship `&amp;apos;` where
 * they mean an apostrophe, so one pass leaves `&apos;` on the page.
 */
function stripTags(html) {
  const decoded = decodeEntities(decodeEntities(String(html || '')))
  return clean(decoded.replace(/<[^>]*>/g, ' '))
}

async function fetchLeagueNews(leagueKey, feeds, terms) {
  const notes = []
  const articles = []
  const seen = new Set()

  for (const feed of feeds) {
    try {
      const xml = await get(feed.url, { retries: 2 })
      const $ = cheerio.load(xml, { xmlMode: true })

      $('item').each((_, el) => {
        const title = clean($(el).find('title').first().text())
        const description = stripTags($(el).find('description').first().text())
        if (!title || !terms.test(`${title} ${description}`)) return

        const key = title.toLowerCase().replace(/\W+/g, '')
        if (seen.has(key)) return
        seen.add(key)

        const published = $(el).find('pubDate').first().text().trim()
        // cheerio's xmlMode parser rejects an escaped `media\:content`
        // selector, so match the namespaced tag by name instead.
        const media = $(el)
          .children()
          .filter((__, c) => /(^|:)(content|thumbnail)$/.test(c.tagName || ''))
          .first()
        const image =
          media.attr('url') || $(el).find('enclosure').first().attr('url') || null

        articles.push({
          id: `${leagueKey}-${key.slice(0, 40)}`,
          league: leagueKey,
          title,
          description: description.slice(0, 280),
          published: published ? new Date(published).toISOString() : null,
          byline: feed.name,
          tag: 'Report',
          image,
          url: clean($(el).find('link').first().text()) || null,
        })
      })
      await sleep(400)
    } catch (err) {
      notes.push(`news ${feed.name}: ${err.message}`)
    }
  }

  articles.sort((a, b) => new Date(b.published || 0) - new Date(a.published || 0))
  return { articles: articles.slice(0, 40), notes }
}

const fetchPBANews = () => fetchLeagueNews('PBA', PBA_FEEDS, PBA_TERMS)

async function scrapePBAFromWikipedia() {
  const notes = ['pba.ph is behind a Cloudflare bot check; built from Wikipedia instead.']
  const $ = await wikiPage('Philippine Basketball Association')

  const table = $('table.wikitable').first()
  const teams = []
  table.find('tr').slice(1).each((_, tr) => {
    const cells = $(tr).find('th,td')
    const link = $(cells[0]).find('a').first()
    const name = clean(link.text()) || clean($(cells[0]).text())
    if (!name) return
    teams.push({
      id: name.replace(/\W+/g, '-').toLowerCase(),
      league: 'PBA',
      name,
      shortName: name,
      abbr: name.split(/\s+/).map((w) => w[0]).join('').slice(0, 4).toUpperCase(),
      company: clean($(cells[1]).text()) || null,
      wikiPage: link.attr('title') || name,
      logo: null,
    })
  })

  if (!teams.length) throw new Error('no PBA teams parsed from Wikipedia')

  const rosters = {}
  for (const t of teams) {
    try {
      const $$ = await wikiPage(t.wikiPage)
      const players = await pbaRosterFromWikipedia($$, t.name)
      if (players.length) rosters[t.id] = players
      process.stdout.write(`  PBA ${t.name} (${players.length} players)\n`)
      await sleep(300)
    } catch (err) {
      notes.push(`roster ${t.name}: ${err.message}`)
    }
  }

  const news = await fetchPBANews()
  notes.push(...news.notes)

  return {
    league: 'PBA',
    season: String(new Date().getFullYear()),
    fetchedAt: new Date().toISOString(),
    sources: [
      { name: 'Wikipedia (CC BY-SA)', url: 'https://en.wikipedia.org/wiki/Philippine_Basketball_Association' },
      ...PBA_FEEDS.map((f) => ({ name: f.name, url: f.url.replace(/\/(feed|rss)\b.*$/, '') })),
    ],
    notes,
    teams,
    rosters,
    standings: { seasonLabel: '', rows: [] },
    games: [],
    news: news.articles,
    leaders: {},
  }
}

async function scrapePBA() {
  // Prefer the league's own site when the bot check happens to be down.
  try {
    const html = await get('https://www.pba.ph/teams', { retries: 1 })
    if (/Just a moment|cf-browser-verification|challenge-platform/i.test(html)) {
      throw new Error('Cloudflare challenge')
    }
    const $ = cheerio.load(html)
    const teams = []
    $('a[href*="/teams/"]').each((_, el) => {
      const href = $(el).attr('href') || ''
      const slug = href.split('/teams/')[1]?.replace(/\/$/, '')
      const name = clean($(el).text())
      if (!slug || !name || teams.some((t) => t.id === slug)) return
      teams.push({
        id: slug,
        league: 'PBA',
        name,
        shortName: name,
        abbr: name.slice(0, 3).toUpperCase(),
        logo: $(el).find('img').attr('src') || null,
      })
    })
    if (teams.length >= 8) {
      const news = await fetchPBANews()
      return {
        league: 'PBA',
        season: String(new Date().getFullYear()),
        fetchedAt: new Date().toISOString(),
        sources: [
          { name: 'pba.ph', url: 'https://www.pba.ph' },
          ...PBA_FEEDS.map((f) => ({ name: f.name, url: f.url.replace(/\/(feed|rss)\b.*$/, '') })),
        ],
        notes: news.notes,
        teams,
        rosters: {},
        standings: { seasonLabel: '', rows: [] },
        games: [],
        news: news.articles,
        leaders: {},
      }
    }
  } catch {
    /* fall through to Wikipedia */
  }

  return scrapePBAFromWikipedia()
}

// ───────────────────────────────────────────────────────────────────────────

const SCRAPERS = {
  bleague: { key: 'BLeague', run: scrapeBLeague },
  kbl: { key: 'KBL', run: scrapeKBL },
  pba: { key: 'PBA', run: scrapePBA },
  cba: { key: 'CBA', run: scrapeCBA },
  tpbl: { key: 'TPBL', run: scrapeTPBL },
}

async function main() {
  const requested = process.argv.slice(2).map((s) => s.toLowerCase())
  const jobs = requested.length
    ? requested.filter((r) => SCRAPERS[r])
    : Object.keys(SCRAPERS)

  if (!jobs.length) {
    console.error(`Unknown league. Options: ${Object.keys(SCRAPERS).join(', ')}`)
    process.exit(1)
  }

  await fs.mkdir(OUT_DIR, { recursive: true })

  const results = []
  for (const job of jobs) {
    const { key, run } = SCRAPERS[job]
    console.log(`\n▶ ${key}`)
    try {
      const data = await run()
      const file = path.join(OUT_DIR, `${key}.json`)
      await fs.writeFile(file, JSON.stringify(data, null, 2))
      const players = Object.values(data.rosters).reduce((n, r) => n + r.length, 0)
      console.log(
        `✔ ${key}: ${data.teams.length} teams, ${players} players, ` +
          `${data.games.length} games, ${data.standings.rows.length} standings rows`
      )
      if (data.notes?.length) {
        console.log(`  notes: ${data.notes.length}`)
        data.notes.slice(0, 5).forEach((n) => console.log(`   · ${n}`))
      }
      results.push({ key, ok: true })
    } catch (err) {
      // Deliberately leave any existing snapshot alone.
      console.error(`✘ ${key}: ${err.message}`)
      console.error('  existing snapshot left untouched')
      results.push({ key, ok: false, error: err.message })
    }
  }

  const failed = results.filter((r) => !r.ok)
  console.log(
    `\n${results.length - failed.length}/${results.length} leagues captured` +
      (failed.length ? ` — failed: ${failed.map((f) => f.key).join(', ')}` : '')
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

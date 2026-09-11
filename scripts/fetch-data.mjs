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
import {
  REALGM_LEAGUES,
  realgmPlayerStats,
  realgmStandings,
  tpblPlayerStats,
  tpblStandings,
  tpblNews,
  buildLeaders,
  combineConferenceStats,
} from './player-stats.mjs'
import { translate, saveTranslationCache } from './translate.mjs'

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

  // Player statistics. bleague.jp publishes rosters but no English stats
  // table, so averages come from RealGM. Rosters scraped above already carry
  // jersey numbers and positions, so these only add the numbers.
  let playerStats = []
  let leaders = {}
  try {
    const st = await realgmPlayerStats('BLeague')
    playerStats = st.players
    notes.push(...st.notes)
    for (const p of playerStats) {
      const club = matchTeam(p.teamName || p.teamAbbr, teams)
      if (club) p.teamId = club.id
    }
    const unmatched = playerStats.filter((p) => !p.teamId).length
    if (unmatched) notes.push(`${unmatched} B.League players could not be matched to a club`)
    const built = buildLeaders(playerStats)
    leaders = built.leaders || {}
    if (built.minGames) notes.push(`Leaders require at least ${built.minGames} games played.`)
  } catch (err) {
    notes.push(`player stats: ${err.message}`)
  }

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
    playerStats,
    standings: await standingsFor('BLeague', teams, notes),
    games: fixtures.games,
    news: news.articles,
    leaders,
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

/**
 * Loose token match: "Alvark To." → "Alvark Tokyo".
 *
 * Refuses to guess. If two clubs score equally well the label is ambiguous and
 * we return null rather than pick one — "Beijing" fits both Beijing BeiKong and
 * Beijing Shougang, and "Zhejiang" fits both Zhejiang clubs. Picking the first
 * one silently merged two teams' rosters into one in an earlier build. An
 * unmatched label is visible in the notes; a wrong match is invisible.
 */
function matchTeam(label, teams) {
  const norm = (x) => (x || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
  const target = norm(label)
  if (!target) return null

  const scored = []
  for (const t of teams) {
    const name = norm(t.name)
    let score = 0
    for (const token of target.split(' ')) {
      if (token.length < 2) continue
      if (name.includes(token)) score += token.length
      else if (name.split(' ').some((w) => w.startsWith(token))) score += token.length - 1
    }
    if (score >= 3) scored.push({ t, score })
  }
  if (!scored.length) return null

  scored.sort((a, b) => b.score - a.score)
  if (scored.length > 1 && scored[1].score === scored[0].score) return null
  return scored[0].t
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
    source: 'asia-basket',
  },
  TPBL: {
    url: 'https://www.asia-basket.com/Taiwan/basketball-League-TPBL.aspx',
    site: 'https://www.asia-basket.com/Taiwan/basketball.aspx',
    source: 'asia-basket',
  },
  // Same network, same table format, covering the Americas.
  NBB: {
    url: 'https://www.latinbasket.com/Brazil/basketball-League-NBB.aspx',
    site: 'https://www.latinbasket.com/Brazil/basketball.aspx',
    source: 'latinbasket',
  },
  PBA: {
    url: 'https://www.asia-basket.com/Philippines/basketball-League-PBA.aspx',
    site: 'https://www.asia-basket.com/Philippines/basketball.aspx',
    source: 'asia-basket',
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
const SCORE_RE = /^\d{1,3}\s*-\s*\d{1,3}$/

/**
 * Find the results table on a league page.
 *
 * On asia-basket's CBA page it is the first table; on latinbasket's NBB page
 * it is the nineteenth, behind a playoff bracket and a dozen widget tables.
 * So rather than assume a position, pick the table with the most rows that
 * look like results or fixtures.
 */
function pickResultsTable($) {
  let best = null
  let bestCount = 0
  $('table').each((_, t) => {
    let count = 0
    $(t)
      .find('tr')
      .each((__, tr) => {
        const cells = $(tr)
          .find('td,th')
          .map((___, c) => clean($(c).text()))
          .get()
        const looksLikeRow =
          cells.length >= 3 &&
          (cells.some((c) => SCORE_RE.test(c)) || cells.some((c) => c.length < 10 && monthDay(c)))
        if (looksLikeRow) count++
      })
    if (count > bestCount) {
      bestCount = count
      best = t
    }
  })
  return best ? $(best).find('tr').toArray() : []
}

/**
 * Parse results/fixtures rows. Sides carry the source's own label; mapping
 * labels onto real clubs happens afterwards, once we know the club list.
 */
function parseResultRows($, rows, limit) {
  const games = []
  const now = new Date()
  let year = now.getFullYear()
  let prevMonth = now.getMonth()

  for (const tr of rows.slice(0, limit)) {
    const cells = $(tr)
      .find('td,th')
      .map((_, c) => clean($(c).text()))
      .get()
      .filter(Boolean)
    if (cells.length < 3) continue

    const scoreIdx = cells.findIndex((c) => SCORE_RE.test(c))
    const played = scoreIdx > 0
    let dateLabel
    let home
    let away
    let homeScore = null
    let awayScore = null

    if (played) {
      dateLabel = cells[0]
      home = cells[scoreIdx - 1]
      away = cells[scoreIdx + 1]
      const [h, a] = cells[scoreIdx].split('-').map((n) => Number(n.trim()))
      homeScore = h
      awayScore = a
    } else {
      const dateIdx = cells.findIndex((c) => monthDay(c))
      if (dateIdx < 1 || dateIdx >= cells.length - 1) continue
      dateLabel = cells[dateIdx]
      home = cells[dateIdx - 1]
      away = cells[dateIdx + 1]
    }

    const md = monthDay(dateLabel)
    if (!md || !home || !away || home === away) continue

    // The table runs newest-first with no years; a month jumping forward as
    // we descend means we have crossed back into the previous year.
    if (md.month > prevMonth) year -= 1
    prevMonth = md.month
    const date = new Date(Date.UTC(year, md.month, md.day, 11, 0, 0)).toISOString()

    games.push({ date, played, home, away, homeScore, awayScore })
  }
  return { games, year }
}

/**
 * Verified aliases for results-table labels the matcher rightly refuses.
 *
 * These are cases where two real clubs share a name, so no amount of fuzzy
 * scoring can separate them — and the matcher returns null instead of
 * guessing. Each entry here was checked against the league's own table.
 * Keep this list short: it is for genuine collisions, not for silencing
 * notes.
 */
const LABEL_ALIASES = {
  NBB: {
    // Brazil has two Corinthians clubs in the NBB.
    'Corinthi.': 'Corinthians',
    'U.Corinth.': 'Uniao Corinthians',
  },
}

function sideFor(club, label, score) {
  const name = club ? club.name : label
  return {
    id: club ? club.id : slug(label),
    name,
    abbr: name.slice(0, 3).toUpperCase(),
    logo: (club && club.logo) || null,
    score,
    linescores: [],
    leaders: [],
  }
}

/** Non-English news sources, with the language they publish in. */
const EXTRA_NEWS = {
  NBB: {
    name: 'ge — Globo Esporte',
    url: 'https://ge.globo.com/rss/ge/basquete/',
    lang: 'pt',
    terms: new RegExp(
      [
        'NBB', 'LNB', 'Liga Nacional', 'Franca', 'Sesi', 'Pinheiros', 'Minas', 'Paulistano',
        'Bauru', 'Brasília', 'Corinthians', 'Mogi', 'Botafogo', 'Caxias', 'São José',
        'Unifacisa', 'Vasco', 'Flamengo', 'Pato Basquete', 'Fortaleza', 'Cearense',
      ].join('|'),
      'i'
    ),
  },
}

/**
 * Fetch an RSS feed in another language, keep the league's stories, and
 * translate their headlines. Each item keeps its original title and records
 * the source language so the page can label it as machine-translated.
 */
async function fetchTranslatedFeed(leagueKey, cfg) {
  const notes = []
  const articles = []
  try {
    const xml = await get(cfg.url, { retries: 2 })
    const $ = cheerio.load(xml, { xmlMode: true })
    const items = []
    $('item').each((_, el) => {
      const title = stripTags($(el).find('title').first().text())
      const description = stripTags($(el).find('description').first().text())
      if (!title || !cfg.terms.test(`${title} ${description}`)) return
      const media = $(el)
        .children()
        .filter((__, c) => /(^|:)(content|thumbnail)$/.test(c.tagName || ''))
        .first()
      items.push({
        title,
        description,
        link: clean($(el).find('link').first().text()),
        published: $(el).find('pubDate').first().text().trim(),
        image: media.attr('url') || null,
      })
    })

    for (const it of items.slice(0, 15)) {
      const t = await translate(it.title, cfg.lang)
      const d = it.description
        ? await translate(it.description.slice(0, 300), cfg.lang)
        : { text: '', translated: false }
      articles.push({
        id: `${leagueKey}-${slug(it.title).slice(0, 40)}`,
        league: leagueKey,
        title: t.text,
        originalTitle: t.translated ? it.title : null,
        translatedFrom: t.translated ? cfg.lang : null,
        description: d.text,
        published: it.published ? new Date(it.published).toISOString() : null,
        byline: cfg.name,
        tag: 'Report',
        image: it.image,
        url: it.link || null,
      })
    }
    if (items.length && !articles.some((a) => a.translatedFrom)) {
      notes.push(`${leagueKey} news: translation unavailable; headlines kept in the original language`)
    }
  } catch (err) {
    notes.push(`${leagueKey} news: ${err.message}`)
  }
  return { articles, notes }
}

/**
 * Parse a league page into clubs, results, fixtures, standings, player stats
 * and news.
 *
 * Club identity comes from the most authoritative source available, in order:
 *   1. the league's own API        (TPBL: explicit id table)
 *   2. RealGM's standings          (CBA, NBB: full names, unique ids)
 *   3. the results table's labels  (last resort)
 *
 * Players attach to clubs by exact RealGM id, never by name. Results-table
 * labels are mapped onto clubs with the ambiguity-refusing matcher; a label
 * that fits two clubs stays unattributed rather than being assigned to the
 * wrong one.
 */
async function scrapeAsiaBasketLeague(leagueKey, limit = 80) {
  const cfg = ASIA_BASKET_LEAGUES[leagueKey]
  const notes = []
  const html = await get(cfg.url, { retries: 3 })
  const $ = cheerio.load(html)

  const rows = pickResultsTable($)
  if (!rows.length) throw new Error(`no results table on ${cfg.url}`)
  const parsed = parseResultRows($, rows, limit)

  // ── Clubs and standings ──────────────────────────────────────────────────
  let clubs = []
  let standings = { seasonLabel: '', rows: [] }

  if (leagueKey === 'TPBL') {
    clubs = Object.values(TPBL_CLUBS).map((c) => ({
      id: String(c.id),
      league: leagueKey,
      name: c.name,
      nameLocal: c.local,
      shortName: c.name,
      abbr: c.name.slice(0, 3).toUpperCase(),
      logo: null,
    }))
    try {
      standings = await tpblStandings()
      for (const r of standings.rows) {
        const club = clubs.find((c) => c.id === r.team.id)
        if (club) r.team = { ...r.team, name: club.name, abbr: club.abbr }
      }
    } catch (err) {
      notes.push(`standings: ${err.message}`)
    }
  } else if (REALGM_LEAGUES[leagueKey]) {
    try {
      const st = await realgmStandings(leagueKey)
      notes.push(...st.notes)
      standings = { seasonLabel: st.seasonLabel, rows: st.rows }
      clubs = st.rows.map((r) => ({
        id: r.team.id,
        realgmId: r.team.realgmId,
        league: leagueKey,
        name: r.team.name,
        shortName: r.team.name,
        abbr: r.team.name.slice(0, 3).toUpperCase(),
        logo: null,
      }))
    } catch (err) {
      notes.push(`standings: ${err.message}`)
    }
  }

  // ── Games, mapped onto the clubs ─────────────────────────────────────────
  const unmatchedLabels = new Set()
  const resolve = (label) => {
    if (leagueKey === 'TPBL') {
      const c = tpblClub(label)
      return c ? clubs.find((x) => x.id === String(c.id)) || null : null
    }
    if (!clubs.length) return null
    const alias = LABEL_ALIASES[leagueKey]?.[label]
    if (alias) {
      const exact = clubs.find((c) => c.name === alias)
      if (exact) return exact
    }
    const club = matchTeam(label, clubs)
    if (!club) unmatchedLabels.add(label)
    return club
  }

  const games = parsed.games.map((g) => {
    const home = resolve(g.home)
    const away = resolve(g.away)
    return {
      id: `ab-${leagueKey}-${g.date.slice(0, 10)}-${slug(g.home)}-${slug(g.away)}`,
      league: leagueKey,
      status: g.played ? 'final' : 'scheduled',
      statusDetail: g.played ? 'Final' : 'Scheduled',
      period: null,
      clock: null,
      date: g.date,
      venue: null,
      city: null,
      home: sideFor(home, g.home, g.homeScore),
      away: sideFor(away, g.away, g.awayScore),
    }
  })
  if (unmatchedLabels.size) {
    notes.push(
      `${unmatchedLabels.size} results-table labels matched no club unambiguously and were ` +
        `left unattributed: ${[...unmatchedLabels].join(', ')}`
    )
  }

  // No authoritative list at all: fall back to the labels themselves.
  if (!clubs.length) {
    const seen = new Map()
    for (const g of games) {
      for (const s of [g.home, g.away]) {
        if (!seen.has(s.id)) {
          seen.set(s.id, {
            id: s.id,
            league: leagueKey,
            name: s.name,
            shortName: s.name,
            abbr: s.abbr,
            logo: null,
          })
        }
      }
    }
    clubs = [...seen.values()]
  }

  // ── Player statistics ────────────────────────────────────────────────────
  let players = []
  let rosters = {}
  let leaders = {}

  try {
    if (leagueKey === 'TPBL') {
      const st = await tpblPlayerStats()
      players = st.players
      notes.push(...st.notes)
      for (const t of st.teams) {
        const club = clubs.find((c) => c.id === t.id)
        if (club && t.logo) club.logo = t.logo
      }
      rosters = st.rosters
    } else if (REALGM_LEAGUES[leagueKey]) {
      const st = await realgmPlayerStats(leagueKey)
      players = st.players
      notes.push(...st.notes)
      const byRealgm = new Map(clubs.filter((c) => c.realgmId).map((c) => [c.realgmId, c]))
      for (const p of players) {
        // Exact id, never a name guess.
        const club = byRealgm.get(p.teamRealgmId)
        if (!club) continue
        p.teamId = club.id
        if (!rosters[club.id]) rosters[club.id] = []
        rosters[club.id].push({
          id: `${club.id}-${slug(p.name)}`,
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
      if (unmatched) notes.push(`${unmatched} players belong to clubs outside this season's table`)
    }

    const built = buildLeaders(players)
    leaders = built.leaders || {}
    if (built.minGames) notes.push(`Leaders require at least ${built.minGames} games played.`)
  } catch (err) {
    notes.push(`player stats: ${err.message}`)
  }

  // ── News ─────────────────────────────────────────────────────────────────
  let news = { articles: [], notes: [] }
  if (leagueKey === 'TPBL') {
    try {
      const posts = await tpblNews(12)
      for (const p of posts) {
        const t = await translate(p.title, 'zh-TW')
        news.articles.push({
          id: p.id,
          league: 'TPBL',
          title: t.text,
          originalTitle: t.translated ? p.title : null,
          translatedFrom: t.translated ? 'zh-TW' : null,
          description: '',
          published: p.published,
          byline: 'TPBL',
          tag: 'League',
          image: p.image,
          url: p.url,
        })
      }
    } catch (err) {
      news.notes.push(`TPBL news: ${err.message}`)
    }
  } else if (EXTRA_NEWS[leagueKey]) {
    news = await fetchTranslatedFeed(leagueKey, EXTRA_NEWS[leagueKey])
  } else if (NEWS_FEEDS[leagueKey]) {
    news = await fetchLeagueNews(leagueKey, NEWS_FEEDS[leagueKey], NEWS_TERMS[leagueKey])
  }
  notes.push(...news.notes)

  const sources = [{ name: cfg.source, url: cfg.site }]
  if (REALGM_LEAGUES[leagueKey]) {
    sources.push({ name: 'RealGM', url: 'https://basketball.realgm.com/international' })
  }
  if (leagueKey === 'TPBL') sources.push({ name: 'TPBL', url: 'https://tpbl.basketball' })
  if (EXTRA_NEWS[leagueKey]) {
    sources.push({ name: EXTRA_NEWS[leagueKey].name, url: EXTRA_NEWS[leagueKey].url })
  }
  for (const x of NEWS_FEEDS[leagueKey] || []) sources.push({ name: x.name, url: x.url })

  return {
    league: leagueKey,
    season: standings.seasonLabel || String(parsed.year),
    fetchedAt: new Date().toISOString(),
    sources,
    notes,
    teams: clubs.sort((a, b) => a.name.localeCompare(b.name)),
    rosters,
    playerStats: players,
    standings,
    games,
    news: news.articles,
    leaders,
  }
}

/**
 * Attach RealGM standings rows to a league's own club records.
 *
 * KBL and B.League clubs come from their official sources, so standings rows
 * are mapped onto those by full name with the ambiguity-refusing matcher.
 * A row that maps nowhere keeps RealGM's name — shown, but not linked to a
 * club page that would not exist.
 */
async function standingsFor(leagueKey, teams, notes) {
  try {
    const st = await realgmStandings(leagueKey)
    notes.push(...st.notes)
    let unmatched = 0
    for (const r of st.rows) {
      const club = matchTeam(r.team.name, teams)
      if (club) {
        r.team = { ...r.team, id: club.id, name: club.name, abbr: club.abbr, logo: club.logo || null }
      } else {
        unmatched++
      }
    }
    if (unmatched) notes.push(`${unmatched} standings rows matched no club unambiguously`)
    return { seasonLabel: st.seasonLabel, rows: st.rows }
  } catch (err) {
    notes.push(`standings: ${err.message}`)
    return { seasonLabel: '', rows: [] }
  }
}

const scrapeCBA = () => scrapeAsiaBasketLeague('CBA')
const scrapeTPBL = () => scrapeAsiaBasketLeague('TPBL')
const scrapeNBB = () => scrapeAsiaBasketLeague('NBB')

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

  // KBL's own standings come from its API, which has been down. RealGM's
  // KBL table fills the gap until it recovers.
  if (!standings.rows.length) standings = await standingsFor('KBL', teams, notes)

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
      lang: 'ko',
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

/**
 * Guess a headline's language from its script, for feeds that do not declare
 * one. Only scripts are detectable this way — Hangul, kana, Han — which is
 * exactly the case that matters: a Korean or Japanese headline is unreadable
 * to an English reader, so it must not reach the page untranslated.
 * Latin-script languages (Portuguese, Spanish) need an explicit `lang`.
 */
function detectLanguage(text) {
  if (/[\uac00-\ud7af]/.test(text)) return 'ko'
  if (/[\u3040-\u30ff]/.test(text)) return 'ja'
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh-CN'
  return null
}

async function fetchLeagueNews(leagueKey, feeds, terms) {
  const notes = []
  const collected = []
  const seen = new Set()

  for (const feed of feeds) {
    try {
      const xml = await get(feed.url, { retries: 2 })
      const $ = cheerio.load(xml, { xmlMode: true })

      $('item').each((_, el) => {
        const title = stripTags($(el).find('title').first().text())
        const description = stripTags($(el).find('description').first().text())
        if (!title || !terms.test(`${title} ${description}`)) return

        const key = title.toLowerCase().replace(/\W+/g, '').slice(0, 60) || title.slice(0, 60)
        if (seen.has(key)) return
        seen.add(key)

        const published = $(el).find('pubDate').first().text().trim()
        // cheerio's xmlMode parser rejects an escaped `media\\:content`
        // selector, so match the namespaced tag by name instead.
        const media = $(el)
          .children()
          .filter((__, c) => /(^|:)(content|thumbnail)$/.test(c.tagName || ''))
          .first()
        const image = media.attr('url') || $(el).find('enclosure').first().attr('url') || null

        collected.push({
          key,
          feed,
          title,
          description: description.slice(0, 280),
          published: published ? new Date(published).toISOString() : null,
          image,
          url: clean($(el).find('link').first().text()) || null,
        })
      })
      await sleep(400)
    } catch (err) {
      notes.push(`news ${feed.name}: ${err.message}`)
    }
  }

  // Translate anything not in English. `.each` above is synchronous, so the
  // (async) translation happens here, after collection.
  const articles = []
  let untranslated = 0
  for (const item of collected) {
    const lang = item.feed.lang || detectLanguage(item.title)
    let title = item.title
    let description = item.description
    let translatedFrom = null
    let originalTitle = null

    if (lang) {
      const t = await translate(item.title, lang)
      if (t.translated) {
        title = t.text
        originalTitle = item.title
        translatedFrom = lang
        if (item.description) {
          const d = await translate(item.description, lang)
          description = d.text
        }
      } else {
        untranslated++
      }
    }

    articles.push({
      id: `${leagueKey}-${item.key.slice(0, 40)}`,
      league: leagueKey,
      title,
      originalTitle,
      translatedFrom,
      description,
      published: item.published,
      byline: item.feed.name,
      tag: 'Report',
      image: item.image,
      url: item.url,
    })
  }
  if (untranslated) {
    notes.push(`${untranslated} ${leagueKey} headlines could not be translated and were kept as published`)
  }

  articles.sort((a, b) => new Date(b.published || 0) - new Date(a.published || 0))
  return { articles: articles.slice(0, 40), notes }
}

const fetchPBANews = () => fetchLeagueNews('PBA', PBA_FEEDS, PBA_TERMS)

/**
 * PBA results, standings and statistics.
 *
 * The PBA plays three conferences a season — the Philippine Cup, the
 * Commissioner's Cup and the Governors' Cup — and each is its own table. So
 * rather than guess which one is "current", all three are kept as separate
 * groups (the Conference tab shows them side by side), and the league-wide
 * table is the season total: each club's wins and losses summed across the
 * conferences it played.
 */
const PBA_CONFERENCES = [
  { key: 'PBA_PH', id: 130, slug: 'PBA--Philippine-Cup', name: 'Philippine Cup' },
  { key: 'PBA_COMM', id: 131, slug: 'PBA--Commissioners-Cup', name: "Commissioner's Cup" },
  { key: 'PBA_GOV', id: 132, slug: 'PBA--Governors-Cup', name: "Governors' Cup" },
]

async function pbaExtras(teams, notes) {
  const out = { games: [], standings: { seasonLabel: '', rows: [], conferences: [] }, leaders: {}, playerStats: [] }

  // Results and fixtures from asia-basket's PBA page.
  try {
    const cfg = ASIA_BASKET_LEAGUES.PBA
    const $ = cheerio.load(await get(cfg.url, { retries: 3 }))
    const parsed = parseResultRows($, pickResultsTable($), 80)
    const unmatched = new Set()
    out.games = parsed.games.map((g) => {
      const home = matchTeam(LABEL_ALIASES.PBA?.[g.home] || g.home, teams)
      const away = matchTeam(LABEL_ALIASES.PBA?.[g.away] || g.away, teams)
      if (!home) unmatched.add(g.home)
      if (!away) unmatched.add(g.away)
      return {
        id: `ab-PBA-${g.date.slice(0, 10)}-${slug(g.home)}-${slug(g.away)}`,
        league: 'PBA',
        status: g.played ? 'final' : 'scheduled',
        statusDetail: g.played ? 'Final' : 'Scheduled',
        period: null,
        clock: null,
        date: g.date,
        venue: null,
        city: null,
        home: sideFor(home, g.home, g.homeScore),
        away: sideFor(away, g.away, g.awayScore),
      }
    })
    if (unmatched.size) {
      notes.push(`PBA results labels left unattributed: ${[...unmatched].join(', ')}`)
    }
  } catch (err) {
    notes.push(`PBA results: ${err.message}`)
  }

  // Each conference's table and averages from RealGM.
  const statLists = []
  const season = new Map()
  for (const conf of PBA_CONFERENCES) {
    REALGM_LEAGUES[conf.key] = { id: conf.id, slug: conf.slug }
    try {
      const st = await realgmStandings(conf.key)
      notes.push(...st.notes)
      const rows = st.rows.map((r) => {
        const club = matchTeam(r.team.name, teams)
        return club
          ? { ...r, team: { ...r.team, id: club.id, name: club.name, abbr: club.abbr, logo: club.logo || null } }
          : r
      })
      if (rows.length) {
        out.standings.conferences.push({ name: conf.name, abbrev: conf.name, rows })
        out.standings.seasonLabel = st.seasonLabel
        for (const r of rows) {
          const acc = season.get(r.team.id) || { team: r.team, wins: 0, losses: 0 }
          acc.wins += r.wins
          acc.losses += r.losses
          season.set(r.team.id, acc)
        }
      }
      const ps = await realgmPlayerStats(conf.key)
      if (ps.players.length) statLists.push(ps.players)
    } catch (err) {
      notes.push(`${conf.name}: ${err.message}`)
    }
  }

  out.standings.rows = [...season.values()]
    .map((r) => {
      const played = r.wins + r.losses
      return {
        ...r,
        pct: played ? (r.wins / played).toFixed(3).replace(/^0/, '') : '—',
        pointsFor: null,
        pointsAgainst: null,
        diff: null,
        streak: null,
      }
    })
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses)
    .map((r, i, all) => ({
      ...r,
      seed: i + 1,
      gamesBehind: i === 0 ? '—' : String(((all[0].wins - r.wins) + (r.losses - all[0].losses)) / 2),
    }))

  if (statLists.length) {
    out.playerStats = combineConferenceStats(statLists)
    for (const p of out.playerStats) {
      const club = matchTeam(p.teamName || '', teams)
      if (club) p.teamId = club.id
    }
    const built = buildLeaders(out.playerStats)
    out.leaders = built.leaders || {}
    notes.push(
      `PBA leaders combine all ${statLists.length} conferences, weighting each average by games played.`
    )
  }

  return out
}

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

  const extras = await pbaExtras(teams, notes)

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
    standings: extras.standings,
    games: extras.games,
    playerStats: extras.playerStats,
    news: news.articles,
    leaders: extras.leaders,
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

// ───────────────────────────────────────────────────────────────────────────
// Supplements for live leagues
//
// EuroLeague and the NBL are read live in the browser, but their live feeds
// lack something: EuroLeague publishes no news and no player averages, and
// ESPN publishes no NBL leaders. RSS and RealGM cannot be read from a browser
// (no CORS), so those pieces are fetched here and written to
// /public/data/extra/<League>.json. The app uses them only when the live
// source has nothing — live data always wins.
// ───────────────────────────────────────────────────────────────────────────
const EXTRA_OUT = path.join(OUT_DIR, 'extra')

const EUROLEAGUE_FEEDS = [
  { name: 'Eurohoops', url: 'https://www.eurohoops.net/en/feed/' },
  { name: 'Sportando', url: 'https://www.sportando.basketball/en/feed/' },
]
const EUROLEAGUE_TERMS = new RegExp(
  [
    'EuroLeague', 'Euroleague', 'Real Madrid', 'Olympiacos', 'Fenerbahce', 'Fenerbahçe',
    'Panathinaikos', 'Barcelona', 'Anadolu Efes', 'Efes', 'Zalgiris', 'Monaco', 'Partizan',
    'Virtus', 'Maccabi', 'Baskonia', 'Valencia', 'Bayern', 'Crvena Zvezda', 'Red Star',
    'Paris Basketball', 'Dubai', 'Hapoel', 'ASVEL', 'Olimpia Milano', 'Armani',
  ].join('|')
)

/**
 * FIBA tournament leaders, computed from ESPN box scores.
 *
 * ESPN publishes no leaders feed for FIBA events, but every completed game has
 * a full box score. Summing each player's lines across the games they actually
 * played and dividing by those games gives true tournament per-game averages
 * — the same arithmetic a stats desk would do, from the same numbers.
 *
 * A player is counted as having played a game only if they logged minutes, so
 * a DNP does not drag an average down.
 */
async function fibaLeaders(notes) {
  const S = 'https://site.api.espn.com/apis/site/v2/sports/basketball/fiba'
  const d = (o) => {
    const x = new Date()
    x.setDate(x.getDate() + o)
    return x.toISOString().slice(0, 10).replace(/-/g, '')
  }
  const sb = await get(`${S}/scoreboard?dates=${d(-60)}-${d(1)}&limit=300`, { json: true })
  const finals = (sb?.events || []).filter((e) => e.status?.type?.name === 'STATUS_FINAL')
  const eventName = sb?.leagues?.[0]?.name || 'FIBA'
  if (!finals.length) {
    notes.push('FIBA: no completed games in the current window')
    return { leaders: {}, label: '' }
  }

  const totals = new Map()
  for (const ev of finals) {
    try {
      const sum = await get(`${S}/summary?event=${ev.id}`, { json: true })
      for (const side of sum?.boxscore?.players || []) {
        const stat = side.statistics?.[0]
        const labels = stat?.labels || []
        const at = (name) => labels.indexOf(name)
        for (const a of stat?.athletes || []) {
          if (a.didNotPlay) continue
          const v = a.stats || []
          const minutes = parseFloat(v[at('MIN')])
          if (!(minutes > 0)) continue
          const id = a.athlete?.id || a.athlete?.displayName
          const acc = totals.get(id) || {
            name: a.athlete?.displayName,
            headshot: a.athlete?.headshot?.href || null,
            teamAbbr: side.team?.abbreviation || null,
            teamName: side.team?.displayName || null,
            gamesPlayed: 0,
            sums: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0 },
          }
          acc.gamesPlayed += 1
          acc.sums.points += parseFloat(v[at('PTS')]) || 0
          acc.sums.rebounds += parseFloat(v[at('REB')]) || 0
          acc.sums.assists += parseFloat(v[at('AST')]) || 0
          acc.sums.steals += parseFloat(v[at('STL')]) || 0
          acc.sums.blocks += parseFloat(v[at('BLK')]) || 0
          totals.set(id, acc)
        }
      }
      await sleep(150)
    } catch (err) {
      notes.push(`FIBA box score ${ev.id}: ${err.message}`)
    }
  }

  const players = [...totals.values()].map((p) => ({
    name: p.name,
    headshot: p.headshot,
    teamAbbr: p.teamAbbr,
    teamName: p.teamName,
    gamesPlayed: p.gamesPlayed,
    points: p.sums.points / p.gamesPlayed,
    rebounds: p.sums.rebounds / p.gamesPlayed,
    assists: p.sums.assists / p.gamesPlayed,
    steals: p.sums.steals / p.gamesPlayed,
    blocks: p.sums.blocks / p.gamesPlayed,
  }))

  const built = buildLeaders(players)
  notes.push(`FIBA leaders from ${finals.length} box scores, ${players.length} players.`)
  return { leaders: built.leaders || {}, label: `${eventName} tournament averages` }
}

async function buildExtras() {
  const written = []

  // EuroLeague: news + leaders.
  {
    const notes = []
    const news = await fetchLeagueNews('EuroLeague', EUROLEAGUE_FEEDS, EUROLEAGUE_TERMS)
    notes.push(...news.notes)
    let leaders = {}
    try {
      const st = await realgmPlayerStats('EuroLeague')
      notes.push(...st.notes)
      const built = buildLeaders(st.players)
      leaders = built.leaders || {}
    } catch (err) {
      notes.push(`leaders: ${err.message}`)
    }
    written.push({
      key: 'EuroLeague',
      data: {
        league: 'EuroLeague',
        fetchedAt: new Date().toISOString(),
        sources: [...EUROLEAGUE_FEEDS, { name: 'RealGM', url: 'https://basketball.realgm.com/international' }],
        notes,
        news: news.articles,
        leaders,
      },
    })
  }

  // NBL: leaders.
  {
    const notes = []
    let leaders = {}
    try {
      const st = await realgmPlayerStats('NBL')
      notes.push(...st.notes)
      leaders = buildLeaders(st.players).leaders || {}
    } catch (err) {
      notes.push(`leaders: ${err.message}`)
    }
    written.push({
      key: 'NBL',
      data: {
        league: 'NBL',
        fetchedAt: new Date().toISOString(),
        sources: [{ name: 'RealGM', url: 'https://basketball.realgm.com/international' }],
        notes,
        news: [],
        leaders,
      },
    })
  }

  // FIBA: tournament leaders from box scores.
  {
    const notes = []
    let result = { leaders: {}, label: '' }
    try {
      result = await fibaLeaders(notes)
    } catch (err) {
      notes.push(`leaders: ${err.message}`)
    }
    written.push({
      key: 'FIBA',
      data: {
        league: 'FIBA',
        fetchedAt: new Date().toISOString(),
        sources: [{ name: 'ESPN box scores', url: 'https://www.espn.com/basketball/' }],
        notes,
        news: [],
        leaders: result.leaders,
        leadersLabel: result.label,
      },
    })
  }

  await fs.mkdir(EXTRA_OUT, { recursive: true })
  for (const { key, data } of written) {
    await fs.writeFile(path.join(EXTRA_OUT, `${key}.json`), JSON.stringify(data, null, 2))
  }

  // Report in the same shape as the league scrapers.
  return {
    league: 'extras',
    teams: [],
    rosters: {},
    games: [],
    standings: { rows: [] },
    notes: written.map(
      (w) => `${w.key}: ${w.data.news.length} news, ${Object.keys(w.data.leaders).length} leader categories`
    ),
    __extrasOnly: true,
  }
}

const SCRAPERS = {
  bleague: { key: 'BLeague', run: scrapeBLeague },
  kbl: { key: 'KBL', run: scrapeKBL },
  pba: { key: 'PBA', run: scrapePBA },
  cba: { key: 'CBA', run: scrapeCBA },
  tpbl: { key: 'TPBL', run: scrapeTPBL },
  nbb: { key: 'NBB', run: scrapeNBB },
  extras: { key: 'extras', run: buildExtras },
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
      if (!data.__extrasOnly) {
        const file = path.join(OUT_DIR, `${key}.json`)
        await fs.writeFile(file, JSON.stringify(data, null, 2))
      }
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

  await saveTranslationCache()

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

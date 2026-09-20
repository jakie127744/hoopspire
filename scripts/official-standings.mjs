/**
 * Standings from the leagues' own websites.
 *
 * RealGM refuses GitHub's servers, so standings built from it can only refresh
 * from a home connection. These are the official sources, which do answer:
 *
 *   B.League  bleague.jp/standings            HTML, East/West districts,
 *                                             rows link clubs by TeamID
 *   NBB       lnb.com.br/nbb/classificacao    HTML, full names in crest alt
 *   CBA       portal-server.cbaleague.com     JSON, current season only
 *
 * Each returns { seasonLabel, rows, conferences? } in the shape the site
 * already renders, or empty rows when there is nothing to report — for example
 * a season that has not started — so the caller falls back rather than
 * publishing a table of zeros.
 *
 * Not here, and why:
 *   KBL  its official API (api.kbl.or.kr) returns HTTP 500 to everyone,
 *        including its own website. The KBL scraper already tries it first.
 *   PBA  pba.ph sits behind a Cloudflare challenge. Not worked around.
 *   CBA  data-server.cbaleague.com encrypts its responses, which are
 *        decrypted by the site's own script. Not reverse-engineered — the
 *        portal server publishes the same table in the clear.
 */
import * as cheerio from 'cheerio'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const clean = (s) => (s || '').replace(/\s+/g, ' ').trim()
const int = (v) => {
  const n = parseInt(String(v).replace(/[^0-9-]/g, ''), 10)
  return Number.isFinite(n) ? n : null
}
const pct = (w, l) => (w + l ? (w / (w + l)).toFixed(3).replace(/^0/, '') : '—')

async function get(url, { json = false } = {}) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en,ja;q=0.8' } })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return json ? res.json() : res.text()
}

/** Games behind the leader of a group, computed from its own table. */
function withGamesBehind(rows) {
  const lead = rows[0]
  return rows.map((r, i) => ({
    ...r,
    gamesBehind:
      r.gamesBehind ?? (i === 0 || !lead ? '—' : String((lead.wins - r.wins + (r.losses - lead.losses)) / 2)),
  }))
}

// ───────────────────────────────────────────────────────────────────────────
// B.League
// ───────────────────────────────────────────────────────────────────────────

function parseBLeague(html, translate) {
  const $ = cheerio.load(html)
  const selected = $('select[name="year-b1"] option[selected]').attr('value')
  const conferences = []

  $('table').each((_, table) => {
    // Each table follows a heading: 東地区 (East), 西地区 (West), and a
    // ワイルドカード (wildcard) view that repeats teams — skip that one.
    // The label is the element just before the table's scroll wrapper.
    const heading = clean($(table).parent().prev().text()) || ''
    const name = /東/.test(heading) ? 'East' : /西/.test(heading) ? 'West' : /中/.test(heading) ? 'Central' : null
    if (!name) return

    const rows = []
    $(table)
      .find('tbody tr')
      .each((i, tr) => {
        const td = $(tr).find('td')
        const href = td.eq(1).find('a').attr('href') || ''
        const teamId = (href.match(/TeamID=(\d+)/) || [])[1]
        const local = clean(td.eq(1).find('.team-name-line').text()) || clean(td.eq(1).text())
        const wins = int(td.eq(2).text())
        const losses = int(td.eq(3).text())
        if (!teamId || wins == null || losses == null) return
        const pf = int(td.eq(6).text())
        const pa = int(td.eq(7).text())
        rows.push({
          team: {
            id: teamId,
            name: translate(local) || local,
            nameLocal: local,
            abbr: null,
            logo: td.eq(1).find('img').attr('src') || null,
          },
          wins,
          losses,
          pct: pct(wins, losses),
          gamesBehind: clean(td.eq(5).text()) || null,
          pointsFor: pf,
          pointsAgainst: pa,
          diff: clean(td.eq(8).text()) || null,
          streak: clean(td.eq(12).text()) || null,
          seed: int(td.eq(0).text()) ?? i + 1,
        })
      })
    if (rows.length) conferences.push({ name, abbrev: name, rows })
  })

  return { season: selected ? Number(selected) : null, conferences }
}

/**
 * The official page defaults to the current season. Before it has started
 * every cell is "-", so we step back one season to the last completed table.
 */
export async function bleagueStandings({ translate = (x) => x } = {}) {
  const base = 'https://www.bleague.jp/standings/'
  let parsed = parseBLeague(await get(base), translate)
  let season = parsed.season

  if (!parsed.conferences.some((c) => c.rows.length) && season) {
    season -= 1
    parsed = parseBLeague(await get(`${base}?tab=1&year=${season}`), translate)
  }
  if (!parsed.conferences.length) return { seasonLabel: '', rows: [], conferences: [] }

  const rows = parsed.conferences
    .flatMap((c) => c.rows)
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses)
    .map((r, i) => ({ ...r, seed: i + 1, gamesBehind: null }))

  return {
    seasonLabel: season ? `${season}-${String(season + 1).slice(2)}` : '',
    rows: withGamesBehind(rows),
    conferences: parsed.conferences,
    source: 'bleague.jp',
  }
}

// ───────────────────────────────────────────────────────────────────────────
// NBB
// ───────────────────────────────────────────────────────────────────────────

/**
 * The page carries two copies of the table; the second is the one whose
 * header order matches its cells, so rows are read by header name from it.
 * Every other row is a hidden "more stats" expander and is skipped.
 */
export async function nbbStandings() {
  const $ = cheerio.load(await get('https://lnb.com.br/nbb/classificacao/'))
  const tables = $('table').toArray()
  let rows = []

  for (const table of tables.reverse()) {
    const headers = $(table)
      .find('thead th, tr')
      .first()
      .find('th,td')
      .map((_, h) => clean($(h).text()).toUpperCase())
      .get()
    const at = (n) => headers.indexOf(n)
    if (at('VIT') < 0 || at('DER') < 0) continue

    const parsed = []
    $(table)
      .find('tbody tr')
      .each((_, tr) => {
        const td = $(tr).find('td')
        const first = td.eq(0)
        const position = int(first.find('.number').text())
        const name = clean(first.find('.logo img').attr('alt'))
        if (!position || !name) return
        const cell = (n) => clean(td.eq(at(n)).text())
        const wins = int(cell('VIT'))
        const losses = int(cell('DER'))
        if (wins == null || losses == null) return
        const pf = int(cell('PRO'))
        const pa = int(cell('CON'))
        parsed.push({
          team: {
            id: null,
            name,
            abbr: clean(first.find('.team_first').text()) || null,
            logo: first.find('.logo img').attr('src') || null,
          },
          wins,
          losses,
          pct: pct(wins, losses),
          pointsFor: pf,
          pointsAgainst: pa,
          diff: cell('SAL') || (pf != null && pa != null ? String(pf - pa) : null),
          streak: null,
          seed: position,
        })
      })
    if (parsed.length) {
      rows = parsed
      break
    }
  }

  rows.sort((a, b) => a.seed - b.seed)

  // The season selector marks which table is on display ("NBB 2025/2026").
  const selected = clean($('select option[selected]').first().text())
  const m = selected.match(/(20\d\d)\s*\/\s*(20)?(\d\d)/)
  const seasonLabel = m ? `${m[1]}-${m[3]}` : ''

  return { seasonLabel, rows: withGamesBehind(rows), source: 'lnb.com.br' }
}

// ───────────────────────────────────────────────────────────────────────────
// CBA
// ───────────────────────────────────────────────────────────────────────────

/**
 * Official CBA team ids → the club names used across this site.
 *
 * The API's English names are spaced pinyin ("BEI JING", "BEI KONG",
 * "ZHE JIANG", "GUANG SHA"), and Beijing and Zhejiang each have two clubs —
 * the exact case where name matching merged two rosters once already. So the
 * mapping is explicit, and each pair was settled by its Chinese name:
 * 北京首钢 is Shougang, 北京控股 BeiKong, 浙江广厦 Guangsha, 浙江稠州 Chouzhou.
 */
export const CBA_CLUBS = {
  29125: 'Shanghai Dongfang', // 上海久事
  29128: 'Zhejiang Guangsha', // 浙江广厦
  29131: 'Shenzhen', // 深圳新世纪
  29115: 'Beijing Shougang', // 北京首钢
  29124: 'Guangdong Dongguan', // 广东宏远
  29140: 'Zhejiang Chouzhou', // 浙江稠州
  29130: 'Shandong', // 山东山高
  29132: 'Shanxi Zhongyu', // 山西汾酒
  29135: 'Qingdao', // 青岛国信
  29129: 'Liaoning', // 辽宁沈阳
  100074683: 'Ningbo Rockets', // 宁波富邦
  29139: 'Guangzhou Loong Lions', // 广州龙狮
  29136: 'Beijing BeiKong', // 北京控股
  29134: 'Fujian', // 福建鲟浔兴
  29137: 'Jilin Northeast', // 吉林东北虎
  29117: 'Xinjiang Guanghui', // 新疆广汇
  29133: 'Nanjing Tongxi Monkey King', // 南京同曦
  29138: 'Tianjin Ronggang', // 天津荣钢
  29118: 'Jiangsu Kendia', // 江苏肯帝亚
  29127: 'Sichuan Blue Whales', // 四川锦城
}

export async function cbaStandings() {
  const body = await get('https://portal-server.cbaleague.com/team/rank?ranktype=', { json: true })
  const list = body?.data || []
  const played = list.reduce((n, r) => n + (r.MatchPlayed || 0), 0)
  const season = list[0]?.CurrSeason

  // Official crests, keyed by our club name — valid whatever the season.
  const crests = {}
  for (const r of list) {
    if (CBA_CLUBS[r.TeamID] && r.SmallLogo) crests[CBA_CLUBS[r.TeamID]] = `https:${r.SmallLogo}`
  }

  // The portal only serves the current season. Before tip-off it is twenty
  // rows of zeros — report no table, so the finished one is kept instead.
  if (!played) {
    return {
      seasonLabel: '',
      rows: [],
      crests,
      source: 'cbaleague.com',
      note: `CBA ${season ?? 'current'} season has not started on the official site`,
    }
  }

  const unknown = []
  const rows = list
    .map((r) => {
      const name = CBA_CLUBS[r.TeamID]
      if (!name) unknown.push(`${r.TeamID} ${r.TeamENName}`)
      const wins = r.Wins ?? 0
      const losses = r.Losses ?? 0
      return {
        team: {
          id: null,
          officialId: r.TeamID,
          name: name || clean(r.TeamENName),
          nameLocal: r.TeamCNAlias || r.TeamCNName || null,
          abbr: r.TeamENAlias || null,
          logo: r.SmallLogo ? `https:${r.SmallLogo}` : null,
        },
        wins,
        losses,
        pct: pct(wins, losses),
        pointsFor: typeof r.Points === 'number' ? Number(r.Points.toFixed(1)) : null,
        pointsAgainst: typeof r.PointsAgainst === 'number' ? Number(r.PointsAgainst.toFixed(1)) : null,
        diff: typeof r.PointsWinOrLoss === 'number' ? r.PointsWinOrLoss.toFixed(1) : null,
        streak: r.StreakString && r.StreakString !== '-' ? r.StreakString : null,
        seed: r.CBARank ?? null,
      }
    })
    .sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99))

  return {
    seasonLabel: season ? `${season}-${String(season + 1).slice(2)}` : '',
    rows: withGamesBehind(rows),
    crests,
    source: 'cbaleague.com',
    note: unknown.length ? `CBA clubs not in CBA_CLUBS (add them): ${unknown.join(', ')}` : null,
  }
}

/**
 * Official NBB club codes → the club names used across this site.
 *
 * Keyed by the league's own three-letter code, not the display name: names
 * carry sponsor prefixes that change every season ("CAIXA/Brasília",
 * "Ceisc/União Corinthians", "Conta Simples Rio Claro"). And name matching is
 * not safe here — "Mogi Basquete" scored as close to Basquete Cearense and
 * Caxias (the shared word "Basquete") as to Mogi, and Brazil has two
 * Corinthians clubs. Each entry was checked against the official table.
 */
export const NBB_CLUBS = {
  FRA: 'Franca',
  PIN: 'Pinheiros Sky',
  MIN: 'Minas',
  BRA: 'Uniceub-BRB-Brasilia',
  FLA: 'Flamengo',
  COR: 'Corinthians',
  CAP: 'Paulistano',
  SJO: 'Sao Jose Unimed Vinac',
  MOG: 'Mogi das Cruzes',
  BAU: 'Bauru',
  UFC: 'Unifacisa Paraiba',
  UCO: 'Uniao Corinthians',
  CAX: 'Caxias Do Sul Basquetetriches',
  CRU: 'Cruzeiro',
  RCB: 'Rio Claro Basquete',
  BOT: 'Botafogo F.R.',
  BCE: 'Basquete Cearense',
  PAT: 'Pato Basquete',
  OSA: 'Osasco Basquete',
  VAS: 'Vasco da Gama',
}

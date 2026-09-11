/**
 * Player careers — the "where have they played" history for international
 * leagues.
 *
 *   node scripts/fetch-data.mjs careers
 *
 * ESPN's athlete API only knows a player's career inside the ESPN league it is
 * serving: Luka Doncic's there begins at 2018-19 Dallas, with no Real Madrid.
 * RealGM's player pages carry the rest — bio, college, and an international
 * career by season, team *and league*, with transfer dates. That is the
 * background a profile needs for the leagues this site covers.
 *
 * Scope and politeness
 * --------------------
 * One page per player, at RealGM's requested crawl delay. Fetching every
 * player in every snapshot would take well over an hour, so by default this
 * fetches players who appear on a leaders table — the players readers
 * actually open — and caches each career for 30 days, so later runs only
 * fetch players who are new. Pass `--all` to include every player.
 *
 * Output: /public/data/players/<realgmId>.json, loaded by the profile page
 * only when that player is opened.
 *
 * RealGM's photos are their licensed images and are deliberately not stored.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import * as cheerio from 'cheerio'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA = path.join(__dirname, '..', 'public', 'data')
const OUT = path.join(DATA, 'players')
const CACHE = path.join(__dirname, '.cache', 'careers')

// RealGM's robots.txt asks for 2s. This job makes many consecutive requests
// to one host, and a 2.5s pace still drew a bot-check page after ~55 players,
// so it runs at twice the requested delay.
const DELAY_MS = 5000

// Bump when the parser changes, so careers cached by an older parser are
// re-fetched instead of served for 30 days with fields missing.
const PARSER_VERSION = 2
const TTL_MS = 30 * 24 * 60 * 60 * 1000

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const run = promisify(execFile)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const clean = (s) => (s || '').replace(/\s+/g, ' ').trim()
const num = (v) => {
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

async function curlGet(url) {
  const { stdout } = await run(
    'curl',
    ['-sL', '--compressed', '-m', '40', '-H', `User-Agent: ${UA}`, '-H', 'Accept: text/html', url],
    { maxBuffer: 32 * 1024 * 1024 }
  )
  return stdout
}

/** Read a per-game summary table into rows keyed by its own header names. */
function readTable($, table) {
  const headers = $(table)
    .find('thead th')
    .map((_, th) => clean($(th).text()))
    .get()
  const rows = []
  $(table)
    .find('tbody tr')
    .each((_, tr) => {
      const cells = $(tr)
        .find('td')
        .map((__, td) => clean($(td).text()))
        .get()
      if (!cells.length) return
      const row = {}
      headers.forEach((h, i) => {
        row[h] = cells[i] ?? ''
      })
      rows.push(row)
    })
  return rows
}

/**
 * Career tables have stable ids. The `-1` variant is the compact per-game
 * view; the others are totals and advanced splits of the same seasons.
 *
 *   tabs_nba_reg-1            NBA regular season
 *   tabs_dleague_full-1       G League — RealGM still files it under its old
 *                             "D-League" name, and as `full`, not `reg`
 *   tabs_international_reg-1  every other professional league
 *   tabs_ncaa_reg-1           college
 *
 * `tabs_dleague_showcase-1` is deliberately not read: the Showcase Cup is a
 * subset of the full season, and adding it would count games twice.
 */
function summary($, tableId, leagueName) {
  const table = $(`#${tableId} table`).first()
  if (!table.length) return []
  return readTable($, table).map((r) => ({
    // "2022-23 *" marks a season split between teams; keep just the season.
    season: (r.Season || '').replace(/\s*\*\s*$/, '') || null,
    age: num(r.Age),
    team: r.Team || r.School || null,
    league: r.League || leagueName,
    classYear: r.Class || null,
    gamesPlayed: num(r.GP),
    minutes: num(r.MIN),
    points: num(r.PTS),
    rebounds: num(r.REB),
    assists: num(r.AST),
  }))
}

export function parsePlayerPage(html, id, url) {
  const $ = cheerio.load(html)

  const heading = clean($('h2').first().text())
  // "Kyle Vinales G  #0"
  const hm = heading.match(/^(.*?)\s+([A-Z]{1,2}(?:\/[A-Z]{1,2})?)?\s*#(\d+)?\s*$/)
  const name = clean($('title').text().split(' Player Profile')[0]) || (hm ? clean(hm[1]) : heading)

  const bio = {}
  $('p').each((_, p) => {
    const t = clean($(p).text())
    const m = t.match(/^(Height|Weight|Born|Hometown|Nationality|NBA Draft|High School|Current Team|Agent):\s*(.+)$/)
    if (m) bio[m[1]] = m[2]
  })

  const transactions = []
  const awards = []
  $('table').each((_, t) => {
    const head = $(t)
      .find('thead th')
      .map((__, th) => clean($(th).text()))
      .get()
      .join('|')
    if (head === 'Date|Transaction') {
      for (const r of readTable($, t)) transactions.push({ date: r.Date, text: r.Transaction })
    } else if (head === 'Award|Date') {
      for (const r of readTable($, t)) awards.push({ award: r.Award, date: r.Date })
    }
  })

  return {
    id,
    name,
    position: hm?.[2] || null,
    jersey: hm?.[3] || null,
    url,
    bio: {
      height: bio.Height || null,
      weight: bio.Weight || null,
      born: bio.Born || null,
      hometown: bio.Hometown || null,
      nationality: bio.Nationality || null,
      draft: bio['NBA Draft'] || null,
      highSchool: bio['High School'] || null,
    },
    nba: summary($, 'tabs_nba_reg-1', 'NBA'),
    gleague: summary($, 'tabs_dleague_full-1', 'G League'),
    college: summary($, 'tabs_ncaa_reg-1', 'NCAA'),
    international: summary($, 'tabs_international_reg-1', null),
    parserVersion: PARSER_VERSION,
    transactions: transactions.slice(-20).reverse(),
    awards: awards.slice(0, 20),
    source: 'RealGM',
    fetchedAt: new Date().toISOString(),
  }
}

/** Every RealGM player referenced by the snapshots, and which of them lead. */
async function collectTargets(all) {
  const files = (await fs.readdir(DATA)).filter((f) => f.endsWith('.json'))
  const extraDir = path.join(DATA, 'extra')
  const extras = await fs.readdir(extraDir).catch(() => [])

  const targets = new Map()
  const consider = (p, isLeader) => {
    const id = p.realgmPlayerId || (String(p.playerId || p.id || '').startsWith('rg-') ? String(p.playerId || p.id).slice(3) : null)
    if (!id) return
    const prev = targets.get(id)
    targets.set(id, {
      id,
      name: p.name,
      url: p.realgmUrl || prev?.url || null,
      leader: isLeader || prev?.leader || false,
    })
  }

  const docs = [
    ...(await Promise.all(files.map((f) => fs.readFile(path.join(DATA, f), 'utf8').then(JSON.parse)))),
    ...(await Promise.all(extras.map((f) => fs.readFile(path.join(extraDir, f), 'utf8').then(JSON.parse)))),
  ]
  for (const doc of docs) {
    for (const list of Object.values(doc.leaders || {})) for (const p of list) consider(p, true)
    if (all) for (const p of doc.playerStats || []) consider(p, false)
  }
  return [...targets.values()].filter((t) => all || t.leader)
}

export async function buildCareers({ all = false } = {}) {
  await fs.mkdir(OUT, { recursive: true })
  await fs.mkdir(CACHE, { recursive: true })

  const targets = await collectTargets(all)
  const notes = []
  let fetched = 0
  let cached = 0
  let failed = 0

  for (const t of targets) {
    const cacheFile = path.join(CACHE, `${t.id}.json`)
    let data = null

    try {
      const stat = await fs.stat(cacheFile)
      if (Date.now() - stat.mtimeMs < TTL_MS) {
        const hit = JSON.parse(await fs.readFile(cacheFile, 'utf8'))
        if (hit.parserVersion === PARSER_VERSION) {
          data = hit
          cached++
        }
      }
    } catch {
      /* not cached */
    }

    if (!data) {
      // Prefer the exact link RealGM gave us; its slug is not derivable from
      // the display name ("Q.J. Peterson" is QJ-Peterson).
      const url = t.url || `https://basketball.realgm.com/player/player/Summary/${t.id}`
      try {
        const html = await curlGet(url)
        if (/Just a moment|cf-browser-verification|challenge-platform/i.test(html)) {
          notes.push('RealGM returned a bot-check page; stopping this run')
          break
        }
        data = parsePlayerPage(html, t.id, url)
        await fs.writeFile(cacheFile, JSON.stringify(data))
        fetched++
        process.stdout.write(`  career ${fetched + cached}/${targets.length} ${data.name}\n`)
      } catch (err) {
        failed++
        notes.push(`${t.name}: ${err.message}`)
      }
      await sleep(DELAY_MS)
    }

    if (data) await fs.writeFile(path.join(OUT, `${t.id}.json`), JSON.stringify(data))
  }

  notes.unshift(`${targets.length} players: ${fetched} fetched, ${cached} from cache, ${failed} failed`)
  return notes
}

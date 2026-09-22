#!/usr/bin/env node
/**
 * Pull the box score and full play-by-play for one finished game, and derive
 * the facts a recap is actually built from: scoring runs, lead changes, the
 * biggest lead each side held, who was on the floor for crunch time, and
 * whether any player's line is a season- or career-shaped number.
 *
 * This exists because "watch the game" is not something this pipeline can
 * do — there is no video or audio access here, and even a page-reading
 * browser cannot pull caption text out of a live stream. What ESPN's
 * `summary` endpoint gives instead is better verified: every made basket,
 * miss, foul and substitution, in order, with the score and clock attached.
 * A recap built from this is checkable play by play; one built from watching
 * would not be.
 *
 * Usage:
 *   node scripts/game-facts.mjs <espnSlug> <gameId>
 *   node scripts/game-facts.mjs wnba 401857201
 *
 * Prints JSON. Nothing here is prose — it is the research a writer works
 * from, the same role the Stats agent plays in the editorial pipeline. Every
 * number in the output traces to a specific play or box-score row, so a
 * fact-check pass can re-derive each one independently.
 */
import { pathToFileURL } from 'node:url'
import { fetchWithTimeout } from '../src/lib/http.js'

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/basketball'

async function fetchSummary(espnSlug, gameId) {
  const url = `${SITE}/${espnSlug}/summary?event=${gameId}`
  const res = await fetchWithTimeout(url, {}, 15_000)
  if (!res.ok) throw new Error(`ESPN ${res.status} for ${url}`)
  return res.json()
}

/** Quarter-by-quarter score, read off the last play of each period. */
function quarterScores(plays) {
  const out = []
  let prevAway = 0
  let prevHome = 0
  for (const p of plays) {
    const n = p.period?.number
    if (!n) continue
    if (!out[n - 1]) out[n - 1] = { period: n, away: 0, home: 0 }
    out[n - 1].away = p.awayScore
    out[n - 1].home = p.homeScore
  }
  // Convert running totals to per-period points scored.
  return out.map((q, i) => {
    const prior = out[i - 1] || { away: 0, home: 0 }
    return { period: q.period, away: q.away - prior.away, home: q.home - prior.home }
  })
}

/**
 * Runs of at least `minSwing` unanswered-lead-equivalent points, found by
 * walking the score margin and grouping consecutive movement in one
 * direction. A "run" here means the margin moved that far in one team's
 * favor without the other team scoring in between — the standard meaning.
 */
function scoringRuns(plays, minSwing = 8) {
  const runs = []
  let runTeam = null
  let runStart = null
  let runPoints = 0
  let lastAway = 0
  let lastHome = 0

  const flush = (endPlay) => {
    if (runTeam && runPoints >= minSwing) {
      runs.push({
        team: runTeam,
        points: runPoints,
        startClock: runStart.clock?.displayValue,
        startPeriod: runStart.period?.number,
        endClock: endPlay.clock?.displayValue,
        endPeriod: endPlay.period?.number,
        scoreAfter: `${endPlay.awayScore}-${endPlay.homeScore}`,
      })
    }
    runTeam = null
    runPoints = 0
    runStart = null
  }

  for (const p of plays) {
    if (!p.scoringPlay) continue
    const dAway = p.awayScore - lastAway
    const dHome = p.homeScore - lastHome
    lastAway = p.awayScore
    lastHome = p.homeScore
    const scorer = dAway > 0 ? 'away' : dHome > 0 ? 'home' : null
    if (!scorer) continue

    if (scorer === runTeam) {
      runPoints += dAway || dHome
    } else {
      flush(p)
      runTeam = scorer
      runPoints = dAway || dHome
      runStart = p
    }
  }
  return runs
}

/**
 * How close the trailing team got, from a chosen point in the game onward.
 * Exists because "Connecticut cut it to nine" is the kind of claim easy to
 * get wrong by eyeballing the box score — the real closest approach in one
 * check of this game was 7, at a different point than the final two minutes
 * would suggest, and it is a different number from the final margin.
 */
function closestApproach(plays, fromPeriod = 1) {
  let min = Infinity
  let at = null
  for (const p of plays) {
    if (p.period?.number < fromPeriod) continue
    const margin = Math.abs(p.awayScore - p.homeScore)
    if (margin < min) {
      min = margin
      at = { margin, clock: p.clock?.displayValue, period: p.period?.number, score: `${p.awayScore}-${p.homeScore}` }
    }
  }
  return at
}

/** The biggest lead each team held, and when. */
function biggestLeads(plays) {
  let awayMax = { margin: 0 }
  let homeMax = { margin: 0 }
  for (const p of plays) {
    const margin = p.awayScore - p.homeScore
    if (margin > (awayMax.margin || 0)) {
      awayMax = { margin, clock: p.clock?.displayValue, period: p.period?.number, score: `${p.awayScore}-${p.homeScore}` }
    }
    if (-margin > (homeMax.margin || 0)) {
      homeMax = { margin: -margin, clock: p.clock?.displayValue, period: p.period?.number, score: `${p.awayScore}-${p.homeScore}` }
    }
  }
  return { away: awayMax, home: homeMax }
}

/** How many times the lead changed hands, and how many times it was tied. */
function leadChanges(plays) {
  let changes = 0
  let ties = 0
  let prevSign = 0
  for (const p of plays) {
    const margin = p.awayScore - p.homeScore
    const sign = Math.sign(margin)
    if (sign === 0 && prevSign !== 0) ties++
    if (sign !== 0 && prevSign !== 0 && sign !== prevSign) changes++
    if (sign !== 0) prevSign = sign
  }
  return { changes, ties }
}

/**
 * ESPN's clock switches format inside the final minute: "1:32" above it,
 * "56.8" (bare seconds, no minutes) below it. A parser that only handles
 * "M:SS" silently drops every play in the last minute of a close game —
 * found by hand-checking this exact game, where it cut crunch time off at
 * 1:11 and lost a block and three made baskets in the final minute.
 */
function clockSeconds(display) {
  if (!display) return null
  const withColon = /^(\d+):(\d+)/.exec(display)
  if (withColon) return Number(withColon[1]) * 60 + Number(withColon[2])
  const bareSeconds = /^(\d+(?:\.\d+)?)$/.exec(display)
  if (bareSeconds) return Number(bareSeconds[1])
  return null
}

/**
 * The final two minutes of regulation (or of the last period played), with
 * only scoring plays and the plays immediately before a lead change — the
 * shape of "crunch time" a recap actually needs, not a full transcript.
 */
function crunchTime(plays) {
  const lastPeriod = Math.max(...plays.map((p) => p.period?.number || 0))
  const inWindow = (p) => {
    if (p.period?.number !== lastPeriod) return false
    const secs = clockSeconds(p.clock?.displayValue)
    return secs !== null && secs <= 120
  }
  return plays
    .filter(inWindow)
    .filter((p) => p.scoringPlay || /free throw|turnover|steal|block/i.test(p.text || ''))
    .map((p) => ({
      clock: p.clock?.displayValue,
      text: p.text,
      score: `${p.awayScore}-${p.homeScore}`,
    }))
}

/** Standout box-score lines: 20+ points, double-doubles, triple-doubles. */
function standoutLines(boxscorePlayers) {
  const out = []
  for (const side of boxscorePlayers || []) {
    const labels = side.statistics?.[0]?.labels || []
    const idx = (label) => labels.indexOf(label)
    const ptsI = idx('PTS')
    const rebI = idx('REB')
    const astI = idx('AST')
    for (const row of side.statistics?.[0]?.athletes || []) {
      if (row.didNotPlay) continue
      const stats = row.stats || []
      const pts = Number(stats[ptsI]) || 0
      const reb = Number(stats[rebI]) || 0
      const ast = Number(stats[astI]) || 0
      const doubleDigits = [pts, reb, ast].filter((v) => v >= 10).length
      if (pts >= 20 || doubleDigits >= 2) {
        out.push({
          team: side.team?.abbreviation,
          name: row.athlete?.displayName,
          pts,
          reb,
          ast,
          doubleDouble: doubleDigits === 2,
          tripleDouble: doubleDigits === 3,
        })
      }
    }
  }
  return out.sort((a, b) => b.pts - a.pts)
}

export async function gameFacts(espnSlug, gameId) {
  const data = await fetchSummary(espnSlug, gameId)
  const plays = data.plays || []
  const header = data.header?.competitions?.[0] || {}
  const competitors = header.competitors || []
  const away = competitors.find((c) => c.homeAway === 'away')
  const home = competitors.find((c) => c.homeAway === 'home')

  if (!plays.length) {
    throw new Error(
      'ESPN returned no play-by-play for this game. Do not write a recap from the box score alone and call it a play-by-play account — write from what is actually there, or pick a different game.'
    )
  }

  return {
    teams: {
      away: { name: away?.team?.displayName, abbr: away?.team?.abbreviation, score: Number(away?.score) },
      home: { name: home?.team?.displayName, abbr: home?.team?.abbreviation, score: Number(home?.score) },
    },
    venue: data.gameInfo?.venue?.fullName || null,
    attendance: data.gameInfo?.attendance || null,
    playCount: plays.length,
    quarterScores: quarterScores(plays),
    scoringRuns: scoringRuns(plays),
    biggestLeads: biggestLeads(plays),
    closestApproachSecondHalf: closestApproach(plays, 3),
    leadChanges: leadChanges(plays),
    crunchTime: crunchTime(plays),
    standoutLines: standoutLines(data.boxscore?.players),
    // The AP recap ESPN ships alongside this data, kept here only so a
    // writer can see — and stay clear of — its framing rather than
    // rephrasing it. Never copy from this field into an article.
    doNotUse_apRecapForReferenceOnly: data.article
      ? { headline: data.article.headline, description: data.article.description }
      : null,
  }
}

// CLI entry point. Compared as file URLs, not raw strings, so this works on
// Windows too — `process.argv[1]` there is a backslash path with no
// `file://` prefix, and a naive string comparison never matches it.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [espnSlug, gameId] = process.argv.slice(2)
  if (!espnSlug || !gameId) {
    console.error('Usage: node scripts/game-facts.mjs <espnSlug> <gameId>')
    process.exit(1)
  }
  const facts = await gameFacts(espnSlug, gameId)
  console.log(JSON.stringify(facts, null, 2))
}

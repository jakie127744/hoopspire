/**
 * "If the playoffs started today."
 *
 * Builds the bracket implied by the current standings. Nothing here predicts
 * anything: it seeds the teams exactly as they sit and applies the league's
 * published format.
 *
 * The one honest wrinkle is the play-in. Seeds 7 through 10 do not yet have
 * playoff places — they have a tournament to get through — so the 7 and 8
 * seeds in the first round are marked provisional rather than presented as
 * settled matchups. Showing "2 vs 7" as though the 7 seed were decided would
 * be stating something the standings do not support.
 */

/** Seeded rows for one conference, trimmed to the seeds that matter. */
function seeded(rows) {
  return rows
    .map((r, i) => ({ ...r, seed: r.seed ?? i + 1 }))
    .sort((a, b) => a.seed - b.seed)
}

/**
 * @param {object} league  a league record carrying `playoffFormat`
 * @param {Array}  conferences  from fetchStandingsGrouped()
 */
export function buildPlayoffPicture(league, conferences) {
  const fmt = league?.playoffFormat
  if (!fmt || !conferences?.length) return null

  const [playInFrom, playInTo] = fmt.playIn || []

  const groups = conferences.map((conf) => {
    const rows = seeded(conf.rows || [])
    const at = (seed) => rows.find((r) => r.seed === seed) || null

    const clinched = rows.filter((r) => r.seed <= fmt.berths)
    const playIn = playInFrom
      ? rows.filter((r) => r.seed >= playInFrom && r.seed <= playInTo)
      : []
    const out = rows.filter((r) => r.seed > (playInTo || fmt.berths))

    // Play-in: 7v8 winner takes the 7 seed; 9v10 loser is out; the loser of
    // 7v8 meets the 9v10 winner for the 8 seed.
    const playInGames = playIn.length === 4
      ? [
          {
            id: 'A',
            label: `${playInFrom} v ${playInFrom + 1}`,
            home: at(playInFrom),
            away: at(playInFrom + 1),
            stake: `Winner takes the ${playInFrom} seed`,
          },
          {
            id: 'B',
            label: `${playInTo - 1} v ${playInTo}`,
            home: at(playInTo - 1),
            away: at(playInTo),
            stake: 'Loser is eliminated',
          },
          {
            id: 'C',
            label: 'Loser A v Winner B',
            home: null,
            away: null,
            stake: `Winner takes the ${playInFrom + 1} seed`,
          },
        ]
      : []

    const provisional = new Set(
      playInFrom ? [playInFrom, playInFrom + 1] : []
    )

    const series = (fmt.bracket || []).map(([hi, lo]) => ({
      high: at(hi),
      low: at(lo),
      highSeed: hi,
      lowSeed: lo,
      // A pairing is provisional when either side comes out of the play-in.
      provisional: provisional.has(hi) || provisional.has(lo),
    }))

    return {
      name: conf.name,
      abbrev: conf.abbrev,
      series,
      playInGames,
      clinched,
      playIn,
      out,
    }
  })

  return { groups, format: fmt }
}

/**
 * The Hoopspire masthead.
 *
 * These are desk names, not real people. Hoopspire is written by a very small
 * operation with machine assistance, and a byline here identifies the desk a
 * piece came from and the standard it is held to — not a person you could
 * call. That distinction is stated plainly on /about and repeated at the foot
 * of every desk page, because a masthead that implies a newsroom which does
 * not exist is the kind of thing that costs a site its credibility exactly
 * once.
 *
 * A byline still does real work: readers use it to learn whose judgement they
 * are reading, and to know that the fantasy desk's numbers are built to a
 * different brief than the Margin's.
 */
export const STAFF = [
  {
    id: 'franco-medina',
    byline: 'Franco Medina',
    desk: 'fantasy',
    role: 'Free Minutes',
    /** One line, used under the desk masthead. */
    beat:
      'Projections, category math and roster construction for nine-cat, eight-cat and points leagues.',
    /**
     * The standing method note. Fantasy advice ages badly and is easy to
     * dress up, so the terms are published rather than implied.
     */
    method:
      'Every projection here starts from per-minute production and a stated minutes assumption. Where the minutes are a guess, the piece says so.',
  },
  {
    id: 'hoopspire-staff',
    byline: 'Hoopspire Staff',
    desk: 'margin',
    role: 'The Margin',
    beat: 'Basketball argued from the numbers, across all thirteen leagues in the ledger.',
    method:
      'Claims are checked against the box scores, standings and season averages the ledger already keeps.',
  },
]

export function getStaff(byline) {
  return STAFF.find((s) => s.byline === byline) || null
}

/** The writer who fronts a desk page. */
export function deskLead(desk) {
  return STAFF.find((s) => s.desk === desk) || null
}

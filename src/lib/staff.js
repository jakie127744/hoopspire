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

  /*
   * Full Court Press.
   *
   * The news desk runs several bylines because it covers thirteen leagues in
   * four time zones, and "who follows the PBA here" is a question a reader is
   * entitled to have answered. Each one is a beat, held to the method printed
   * beneath it — and each is a desk name, on the same terms as every other
   * byline on this masthead. /about says so in as many words.
   *
   * `lead: true` marks the one that fronts the desk page; deskLead() would
   * otherwise just return whichever happened to be listed first.
   */
  {
    id: 'dana-whitfield',
    byline: 'Dana Whitfield',
    desk: 'news',
    role: 'Full Court Press — Americas',
    lead: true,
    beat: 'The NBA, WNBA, G League, NCAA and NBB: signings, movement and what a result changed.',
    method:
      'Reported from league releases, official box scores and on-record quotes. Where a report is someone else’s, it is named and linked rather than retold.',
  },
  {
    id: 'tomas-lindqvist',
    byline: 'Tomas Lindqvist',
    desk: 'news',
    role: 'Full Court Press — Europe',
    beat: 'The EuroLeague and the national competitions that feed it.',
    method:
      'Club and federation announcements first, and the competition’s own results service for anything numerical.',
  },
  {
    id: 'marisol-reyes',
    byline: 'Marisol Reyes',
    desk: 'news',
    role: 'Full Court Press — Asia-Pacific',
    beat: 'The PBA, KBL, B.League, CBA, TPBL and NBL, plus FIBA windows across the region.',
    method:
      'Built on each league’s official portal, which is also what the ledger’s snapshots are captured from, so a story and the table behind it cannot disagree.',
  },
]

export function getStaff(byline) {
  return STAFF.find((s) => s.byline === byline) || null
}

/** The writer who fronts a desk page — flagged where a desk has several. */
export function deskLead(desk) {
  const onDesk = STAFF.filter((s) => s.desk === desk)
  return onDesk.find((s) => s.lead) || onDesk[0] || null
}

/** Everyone on a desk, for a masthead that lists more than one beat. */
export function deskStaff(desk) {
  return STAFF.filter((s) => s.desk === desk)
}

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
 * are reading, and to know that the fantasy desk’s numbers are built to a
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
    beat: 'Basketball argued from the numbers, across all fourteen leagues in the ledger.',
    method:
      'Claims are checked against the box scores, standings and season averages the ledger already keeps.',
  },

  /*
   * Full Court Press.
   *
   * One permanent beat writer per league, two on the NBA (owner, 2026-10-06),
   * because "who follows the PBA here" is a question a reader is entitled to
   * have answered. Each is a desk name, on the same terms as every other byline
   * on this masthead, and /about says so in as many words.
   *
   * `leagues` is the beat. `npm run lint:articles` checks that a news piece
   * published from 2026-10-07 carries a byline whose beat includes its league.
   * `lead: true` marks the one that fronts the desk page.
   */
  {
    id: 'dana-whitfield',
    byline: 'Dana Whitfield',
    desk: 'news',
    role: 'Full Court Press — NBA',
    lead: true,
    leagues: ['NBA'],
    beat: 'The NBA: results, signings, trades, injuries and what a night changed in the standings.',
    method:
      'Reported from league and club releases, the official box score and on-record quotes. A single unofficial report is never published as fact.',
  },
  {
    id: 'marcus-oyelaran',
    byline: 'Marcus Oyelaran',
    desk: 'news',
    role: 'Full Court Press — NBA',
    leagues: ['NBA'],
    beat: 'The NBA, second chair: the rest of the slate, front offices, the cap and the transaction wire.',
    method:
      'Reported from league and club releases, the official box score and on-record quotes. A single unofficial report is never published as fact.',
  },
  {
    id: 'renee-castellano',
    byline: 'Renee Castellano',
    desk: 'news',
    role: 'Full Court Press — WNBA',
    leagues: ['WNBA'],
    beat: 'The WNBA: games, playoffs, free agency and the expansion clubs.',
    method:
      'Reported from league and club releases, the official box score and on-record quotes. A single unofficial report is never published as fact.',
  },
  {
    id: 'caleb-brandt',
    byline: 'Caleb Brandt',
    desk: 'news',
    role: 'Full Court Press — G League',
    leagues: ['GLeague'],
    beat: 'The NBA G League: call-ups, two-way contracts, assignments and results.',
    method:
      'Reported from league and club releases, the official box score and on-record quotes. A single unofficial report is never published as fact.',
  },
  {
    id: 'owen-hatcher',
    byline: 'Owen Hatcher',
    desk: 'news',
    role: 'Full Court Press — NCAA',
    leagues: ['NCAAM'],
    beat: 'NCAA men’s basketball: results, the polls, transfers and the road to March.',
    method:
      'Reported from league and club releases, the official box score and on-record quotes. A single unofficial report is never published as fact.',
  },
  {
    id: 'rafael-moura',
    byline: 'Rafael Moura',
    desk: 'news',
    role: 'Full Court Press — Brazil',
    leagues: ['NBB'],
    beat: 'The Novo Basquete Brasil: results, signings and the Brazilians abroad.',
    method:
      'Reported from league and club releases, the official box score and on-record quotes. A single unofficial report is never published as fact.',
  },
  {
    id: 'ines-garduno',
    byline: 'Inés Garduño',
    desk: 'news',
    role: 'Full Court Press — Mexico',
    leagues: ['LNBP'],
    beat: 'Mexico’s LNBP: results, the table and roster moves.',
    method:
      'Built on the league’s own results service. The LNBP publishes no box scores, so its pieces carry none.',
  },
  {
    id: 'tomas-lindqvist',
    byline: 'Tomas Lindqvist',
    desk: 'news',
    role: 'Full Court Press — EuroLeague',
    leagues: ['EuroLeague'],
    beat: 'The EuroLeague and the national competitions that feed it.',
    method:
      'Club and federation announcements first, and the competition’s own results service for anything numerical.',
  },
  {
    id: 'marisol-reyes',
    byline: 'Marisol Reyes',
    desk: 'news',
    role: 'Full Court Press — PBA',
    leagues: ['PBA'],
    beat: 'The PBA: the conferences, the Gilas pool and the Filipino players abroad.',
    method:
      'Reported from league and club releases, the official box score and on-record quotes. A single unofficial report is never published as fact.',
  },
  {
    id: 'han-ji-woo',
    byline: 'Han Ji-woo',
    desk: 'news',
    role: 'Full Court Press — KBL',
    leagues: ['KBL'],
    beat: 'Korea’s KBL: results from the league’s own game records, signings and the table.',
    method:
      'Reported from league and club releases, the official box score and on-record quotes. A single unofficial report is never published as fact.',
  },
  {
    id: 'kenji-arakawa',
    byline: 'Kenji Arakawa',
    desk: 'news',
    role: 'Full Court Press — B.League',
    leagues: ['BLeague'],
    beat: 'Japan’s B.League: results from the league’s game data, signings and the Asian-quota players.',
    method:
      'Reported from league and club releases, the official box score and on-record quotes. A single unofficial report is never published as fact.',
  },
  {
    id: 'lin-haoran',
    byline: 'Lin Haoran',
    desk: 'news',
    role: 'Full Court Press — CBA',
    leagues: ['CBA'],
    beat: 'China’s CBA: results, signings and the national team pool.',
    method:
      'Reported from league and club releases, the official box score and on-record quotes. A single unofficial report is never published as fact.',
  },
  {
    id: 'tsai-pei-shan',
    byline: 'Tsai Pei-shan',
    desk: 'news',
    role: 'Full Court Press — TPBL',
    leagues: ['TPBL'],
    beat: 'Taiwan’s TPBL: results, imports and the table.',
    method:
      'Reported from league and club releases, the official box score and on-record quotes. A single unofficial report is never published as fact.',
  },
  {
    id: 'lachlan-pryor',
    byline: 'Lachlan Pryor',
    desk: 'news',
    role: 'Full Court Press — NBL',
    leagues: ['NBL'],
    beat: 'Australia’s NBL: results, injuries, the Next Stars and the import market.',
    method:
      'Reported from league and club releases, the official box score and on-record quotes. A single unofficial report is never published as fact.',
  },
  {
    id: 'amara-diallo',
    byline: 'Amara Diallo',
    desk: 'news',
    role: 'Full Court Press — FIBA',
    leagues: ['FIBA'],
    beat: 'FIBA: qualifying windows, World Cup and continental cups, and federation rulings.',
    method:
      'Reported from league and club releases, the official box score and on-record quotes. A single unofficial report is never published as fact.',
  },

  /*
   * Opinion (owner, 2026-10-06). Two columnists across all fourteen leagues,
   * each filing twice a week. Opinion is a desk of its own so a reader can
   * never mistake an argument for a report: the news desk states facts, this
   * one says what it thinks of them, and every fact it leans on is checked the
   * same way.
   */
  {
    id: 'victor-ashby',
    byline: 'Victor Ashby',
    desk: 'opinion',
    role: 'Opinion',
    lead: true,
    beat: 'Columns on the decisions that shape a league: coaches, front offices, rules and the calendar.',
    method:
      'The opinions are his. Every fact under them is checked against the record before it runs, and the column says where the evidence stops.',
  },
  {
    id: 'noor-haddad',
    byline: 'Noor Haddad',
    desk: 'opinion',
    role: 'Opinion',
    beat: 'Columns on players, styles of play and the game outside the NBA, from Manila to Madrid.',
    method:
      'The opinions are hers. Every fact under them is checked against the record before it runs, and the column says where the evidence stops.',
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

/** The news writers whose beat includes a league key. */
export function beatWriters(leagueKey) {
  return STAFF.filter((s) => s.desk === 'news' && (s.leagues || []).includes(leagueKey))
}

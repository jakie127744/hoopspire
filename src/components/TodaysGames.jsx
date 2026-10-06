import { Link } from 'react-router-dom'
import { SectionHead, TeamLogo } from './Primitives.jsx'

const SHOW = 8
const LOOKAHEAD_DAYS = 3

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

/** "7:30 PM EDT" — in the reader's own time zone, and saying which one. */
function tipTime(d) {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
}

/**
 * The next day's worth of games, in the reader's time zone.
 *
 * "Tonight" depends on where you are: a KBL game at 7 PM in Seoul is 6 AM
 * in New York. So the day is the reader's local day, and every tip time is
 * shown in their clock with the zone named. When today has nothing left, the
 * module shows the next day that does, up to three days out, and says which
 * day that is. Further out than that it does not render: an empty "Tonight"
 * box on the front page reads as a broken site.
 */
export function pickSlate(games, now = new Date()) {
  const upcoming = games
    .filter((g) => g.status === 'scheduled')
    .map((g) => ({ g, d: new Date(g.date) }))
    .filter(({ d }) => !Number.isNaN(d.getTime()) && d.getTime() > now.getTime() - 15 * 60_000)
    .sort((a, b) => a.d - b.d)
  if (!upcoming.length) return null

  const first = upcoming[0].d
  const horizon = new Date(now)
  horizon.setHours(0, 0, 0, 0)
  horizon.setDate(horizon.getDate() + LOOKAHEAD_DAYS + 1)
  if (first >= horizon) return null

  const key = dayKey(first)
  const items = upcoming.filter(({ d }) => dayKey(d) === key)
  const isToday = key === dayKey(now)
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const title = isToday
    ? "Today's Games"
    : key === dayKey(tomorrow)
      ? "Tomorrow's Games"
      : `${first.toLocaleDateString('en-US', { weekday: 'long' })}'s Games`
  return { title, items }
}

export default function TodaysGames({ games }) {
  const slate = pickSlate(games)
  if (!slate) return null
  const shown = slate.items.slice(0, SHOW)
  const more = slate.items.length - shown.length

  return (
    <section className="mx-auto max-w-7xl px-4 pt-12 md:px-8">
      <SectionHead
        title={slate.title}
        action={
          <Link to="/scores" className="eyebrow text-crimson hover:underline">
            {more > 0 ? `${more} more →` : 'Full schedule →'}
          </Link>
        }
      />
      {/* A row to swipe on a phone, where eight stacked cards would be a
          screen and a half of scrolling; a grid from tablet width up. */}
      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-4">
        {shown.map(({ g, d }) => (
          <Link
            key={`${g.league}-${g.id}`}
            to={`/game/${g.league}/${g.id}`}
            className="card flex w-64 shrink-0 snap-start flex-col gap-3 p-4 transition-shadow hover:shadow-[4px_4px_0_0_var(--color-parchment)] sm:w-auto"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="eyebrow font-bold text-crimson">{g.league}</span>
              <time dateTime={g.date} className="font-mono text-sm font-bold text-ink">
                {tipTime(d)}
              </time>
            </div>
            {[g.away, g.home].map((t, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <TeamLogo team={t} size={24} />
                <span className="truncate text-sm font-medium">{t?.name || 'TBD'}</span>
                {/* 0-0 is every team before the season; it says nothing. */}
                {t?.record && t.record !== '0-0' && (
                  <span className="ml-auto font-mono text-xs text-ink/40">{t.record}</span>
                )}
              </div>
            ))}
            {(g.broadcast || g.venue) && (
              <p className="eyebrow truncate text-ink/45">{g.broadcast || g.venue}</p>
            )}
          </Link>
        ))}
      </div>
    </section>
  )
}

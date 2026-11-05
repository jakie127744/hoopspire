import { Link, useParams } from 'react-router-dom'
import { getOriginals } from '../lib/articles.js'
import { STAFF, getStaff } from '../lib/staff.js'
import { getLeague, MIN_INDEXABLE_STORIES } from '../lib/leagues.js'
import ArticleCard from '../components/ArticleCard.jsx'
import { SectionHead, Eyebrow } from '../components/Primitives.jsx'
import { useMeta } from '../lib/meta.js'

/** Everything filed under a byline, newest first. */
export function piecesBy(byline) {
  return getOriginals().filter((a) => a.byline === byline)
}

/** The staff member behind /staff/:id, or null. */
export function staffById(id) {
  return STAFF.find((s) => s.id === id) || null
}

/**
 * A byline's page: the beat, the method note, and every piece filed under it.
 *
 * Bylines on Hoopspire are desk names, not people, and /about says so. This
 * page says it again and does not dress a desk up as a person: no photo, no
 * biography, no credentials, no social accounts. What a reader can actually
 * check about a desk is what it covers, how it works, and its output, so those
 * are the three things shown.
 */
export default function Staff() {
  const { id } = useParams()
  const writer = staffById(id)
  const pieces = writer ? piecesBy(writer.byline) : []

  useMeta({
    title: writer ? `${writer.byline}, ${writer.role}` : 'Byline',
    description: writer ? `${writer.beat} ${writer.method}` : undefined,
    // A desk with a handful of pieces is a short list, not a page.
    noindex: !writer || pieces.length < MIN_INDEXABLE_STORIES,
  })

  if (!writer) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 md:px-8">
        <h1 className="text-4xl">No such byline.</h1>
        <Link to="/about#bylines" className="eyebrow mt-4 inline-block text-crimson">
          ← Who writes this
        </Link>
      </div>
    )
  }

  const beat = (writer.leagues || []).map((k) => getLeague(k)).filter(Boolean)

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 md:px-8">
      <Eyebrow className="text-crimson">{writer.role}</Eyebrow>
      <h1 className="mt-3 text-4xl md:text-5xl">{writer.byline}</h1>
      <p className="mt-2 font-mono text-xs uppercase tracking-widest text-ink/45">Desk name</p>

      <p className="mt-6 max-w-2xl text-lg text-ink/70">{writer.beat}</p>

      <div className="mt-8 max-w-2xl space-y-4 border-l-2 border-parchment pl-5 text-ink/70">
        <p>
          <span className="font-semibold text-ink/80">How this desk works.</span> {writer.method}
        </p>
        <p>
          <span className="font-semibold text-ink/80">What this byline is.</span> {writer.byline}{' '}
          is an editorial desk name, not a person. Hoopspire is run by one individual, and{' '}
          <Link to="/about#bylines" className="text-crimson underline">
            the Ledger page
          </Link>{' '}
          explains what a byline means and how pieces are checked.
        </p>
        {beat.length > 0 && (
          <p>
            <span className="font-semibold text-ink/80">Covers.</span>{' '}
            {beat.map((l, i) => (
              <span key={l.key}>
                {i > 0 && ', '}
                <Link to={`/league/${l.slug}`} className="text-crimson underline">
                  {l.name}
                </Link>
              </span>
            ))}
            .
          </p>
        )}
        <p>
          Found a mistake in something filed here?{' '}
          <Link to="/contact" className="text-crimson underline">
            Tell us
          </Link>
          .
        </p>
      </div>

      <section className="mt-16">
        <SectionHead title="Filed under this byline">
          <span className="font-mono text-sm text-ink/40">{pieces.length}</span>
        </SectionHead>
        {pieces.length ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {pieces.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        ) : (
          <p className="text-ink/55">Nothing filed under this byline yet.</p>
        )}
      </section>
    </div>
  )
}

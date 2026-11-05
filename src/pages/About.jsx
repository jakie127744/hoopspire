import { Link } from 'react-router-dom'
import { LEAGUES, LEAGUE_COUNT_WORD } from '../lib/leagues.js'
import { STAFF } from '../lib/staff.js'
import { SectionHead, Eyebrow } from '../components/Primitives.jsx'
import { useMeta } from '../lib/meta.js'

export default function About() {
  useMeta({ title: 'About', description: 'What Hoopspire is, where its numbers come from, and how a global basketball ledger across fourteen leagues is put together.' })
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 md:px-8">
      <Eyebrow className="text-crimson">The Ledger</Eyebrow>
      <h1 className="mt-3 text-4xl md:text-5xl">The Ledger</h1>
      <p className="mt-6 text-lg leading-relaxed text-ink/70">
        Hoopspire is a basketball ledger for {LEAGUE_COUNT_WORD.toLowerCase()} leagues. We start
        from the official results and box scores each competition publishes, and everything we
        write is built on numbers we work out ourselves: rankings, scoring margins, on-court
        splits, playoff scenarios and fantasy values.
      </p>

      <section className="mt-16">
        <SectionHead title="The leagues we cover" />
        <div className="grid gap-px border border-parchment bg-parchment sm:grid-cols-2">
          {LEAGUES.map((l) => (
            <div key={l.key} className="bg-cream px-5 py-4">
              <p className="font-display text-2xl">{l.name}</p>
              <Eyebrow className="text-ink/40">{l.region}</Eyebrow>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <SectionHead title="What we do with the numbers" />
        <div className="space-y-5 text-ink/70">
          <p>
            A box score tells you what happened in one game. Our pieces ask what it means, and
            answer with arithmetic we can show. That covers our own Margin Score rankings, per-minute
            and per-possession rates, true shooting against the league average, plus-minus with a
            player on and off the floor, and the tiebreak math behind every playoff race we cover.
          </p>
          <p>
            The fantasy desk turns season averages into category z-scores, punt rankings and
            minutes-based projections, and every piece states the assumption it rests on.
          </p>
          <p>
            Results from the PBA, KBL, B.League and other Asian and Latin American leagues are
            translated into English, so every club and player name reads the same way across the
            site. Each league page shows when its numbers were last updated.
          </p>
        </div>
      </section>

      {/*
        staff.js has always said this distinction was "stated plainly on
        /about". It was not — the page had no byline section at all, while the
        masthead grew to five names. This is that section, and it is deliberately
        before Credit rather than after it: a reader wondering who wrote
        something should not have to reach the last block on the page.
      */}
      <section className="mt-16">
        <SectionHead title="Who runs Hoopspire" />
        <div className="space-y-4 text-ink/70">
          <p>
            Hoopspire is an independent personal project run by one individual based in Florida,
            United States. It is not a registered company and has no newsroom behind it.
          </p>
          <p>
            Every piece is built from the official box scores, standings and season averages this
            site already keeps, and the figures are checked against those records before anything
            is published.
          </p>
        </div>
      </section>

      <section id="bylines" className="mt-16 scroll-mt-24">
        <SectionHead title="Who writes this" />
        <div className="space-y-4 text-ink/70">
          <p>
            Every byline on this site is an editorial desk name, not a named individual, and none
            of them comes with a biography, credentials or social accounts, because there is no
            person behind them to describe. A byline tells you which desk a piece came from and
            the standard it is held to. Each one has a page with its beat, its method and
            everything filed under it.
          </p>
          <ul className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
            {STAFF.map((s) => (
              <li key={s.id}>
                <Link to={`/staff/${s.id}`} className="text-crimson underline">
                  {s.byline}
                </Link>{' '}
                <span className="text-sm text-ink/50">{s.role}</span>
              </li>
            ))}
          </ul>
          <p>
            The bylines on
            this site are Hoopspire Staff on The Margin, Franco Medina on the fantasy desk, a beat
            writer for each league on Full Court Press (two on the NBA), Victor Ashby and Noor
            Haddad on Opinion, and the same FIBA writer and columnists on Heritage Line, the
            scouting desk.
          </p>
          <p>
            What the bylines mean is that the standard behind a piece is fixed and
            public: every number is checked against the box scores, standings and season averages
            this site already keeps, every claim that rests on a sample says how big the sample
            is, and nothing reported by a single unofficial source is published as fact.
          </p>
          <p>
            Corrections are welcome and are the fastest way to make the ledger better —{' '}
            <a href="/contact" className="text-crimson underline">
              tell us
            </a>{' '}
            what looks wrong and which page it is on.
          </p>
        </div>
      </section>

      <section className="mt-16">
        <SectionHead title="Credit" />
        <p className="text-ink/70">
          Results and box scores are published by the competitions themselves. The analysis,
          rankings and writing on this site are Hoopspire's own. Team crests and player portraits
          belong to the leagues and clubs that own them.
        </p>
      </section>
    </div>
  )
}

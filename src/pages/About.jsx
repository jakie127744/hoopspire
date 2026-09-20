import { LEAGUES, LEAGUE_COUNT_WORD } from '../lib/leagues.js'
import { SectionHead, Eyebrow } from '../components/Primitives.jsx'
import { useMeta } from '../lib/meta.js'

const SOURCES = {
  NBA: ['ESPN public JSON — scoreboard, standings, news, teams, rosters, box scores'],
  EuroLeague: ['ESPN public JSON — scoreboard, standings, news, teams, rosters'],
  PBA: ['pba.ph — scraped to /public/data/PBA.json by `npm run data`'],
  KBL: ['api.kbl.or.kr — scraped to /public/data/KBL.json by `npm run data`'],
  BLeague: ['bleague.jp — scraped to /public/data/BLeague.json by `npm run data`'],
}

export default function About() {
  useMeta({ title: 'About', description: 'What Hoopspire is, where its numbers come from, and how a global basketball ledger across thirteen leagues is put together.' })
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 md:px-8">
      <Eyebrow className="text-crimson">The Ledger</Eyebrow>
      <h1 className="mt-3 text-6xl md:text-7xl">The Ledger</h1>
      <p className="mt-6 text-lg leading-relaxed text-ink/70">
        Hoopspire is a global basketball ledger — {LEAGUE_COUNT_WORD.toLowerCase()} leagues, one accounting. Every score,
        standing, roster and headline on this site is fetched from the competitions themselves or
        their wire services. Nothing here is invented, and nothing is filler.
      </p>

      <section className="mt-16">
        <SectionHead title="Where the data comes from" />
        <div className="divide-y divide-parchment border-t border-parchment">
          {LEAGUES.map((l) => (
            <div key={l.key} className="flex flex-col gap-1 py-5 sm:flex-row sm:gap-6">
              <div className="sm:w-40 sm:shrink-0">
                <p className="font-display text-2xl">{l.name}</p>
                <Eyebrow className="text-ink/40">{l.region}</Eyebrow>
              </div>
              <div className="flex-1">
                <p className="text-sm text-ink/70">{SOURCES[l.key]?.[0]}</p>
                <a
                  href={l.site}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="eyebrow mt-2 inline-block text-crimson hover:underline"
                >
                  Official site ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <SectionHead title="Two kinds of feed" />
        <div className="space-y-5 text-ink/70">
          <p>
            <strong className="text-ink">Live leagues</strong> — the NBA and EuroLeague are read
            straight from ESPN's public JSON in your browser. Those endpoints are
            unauthenticated and CORS-open, so there is no API key, no server and no proxy in the
            way. Reload the page and you have the current numbers.
          </p>
          <p>
            <strong className="text-ink">Snapshot leagues</strong> — the PBA, KBL and B.League
            publish no CORS-open API, so a Node script scrapes their official sites into JSON
            files under <code className="font-mono text-xs">/public/data</code>. Run{' '}
            <code className="font-mono text-xs">npm run data</code> to refresh them. Each league
            page shows when its snapshot was captured, so you always know the vintage of what
            you're reading.
          </p>
          <p>
            Korean and Japanese source pages are translated to English during the scrape, so
            every club and player name in the ledger reads in English.
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
        <SectionHead title="Who writes this" />
        <div className="space-y-4 text-ink/70">
          <p>
            Hoopspire is a very small operation working with machine assistance. The bylines on
            this site — Hoopspire Staff, Franco Medina on the fantasy desk, and Dana Whitfield,
            Tomas Lindqvist and Marisol Reyes on Full Court Press — are{' '}
            <strong className="text-ink">desk names, not people you could call</strong>. Each one
            marks which desk a piece came from, which beat it belongs to, and the method it is
            held to. Those methods are printed on the desk pages themselves, not implied.
          </p>
          <p>
            We would rather say that here than let a masthead imply a newsroom that does not
            exist. What the bylines do mean is that the standard behind a piece is fixed and
            public: every number is checked against the box scores, standings and season averages
            this site already keeps, every claim that rests on a sample says how big the sample
            is, and anything reported by someone else is named and linked rather than retold.
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
          Headlines and article copy belong to their publishers — Hoopspire shows the headline and
          dek and links out to the original story. Team crests and player portraits are served from
          the leagues' own media CDNs.
        </p>
      </section>
    </div>
  )
}

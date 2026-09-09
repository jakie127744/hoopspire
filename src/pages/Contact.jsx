import { LegalPage, Section, Value } from '../components/Legal.jsx'
import { SITE, isTodo } from '../lib/site.js'
import { Eyebrow } from '../components/Primitives.jsx'

const REASONS = [
  {
    title: 'Corrections',
    body: 'A score, roster or standing that looks wrong. Include the page and what you expected — most errors trace back to an upstream feed, and knowing which one helps.',
    to: 'email',
  },
  {
    title: 'Copyright and takedowns',
    body: 'If you own material indexed here and want it removed, tell us the page and the item. Valid requests are actioned promptly.',
    to: 'email',
  },
  {
    title: 'Privacy and data requests',
    body: 'Access, deletion or any other data-protection question.',
    to: 'privacyEmail',
  },
  {
    title: 'Everything else',
    body: 'Advertising, partnerships, a league you think belongs in the ledger.',
    to: 'email',
  },
]

export default function Contact() {
  return (
    <LegalPage
      kicker="Get in touch"
      title="Contact"
      intro={`${SITE.name} is a small independent site. Mail reaches a person, and corrections are welcome — they make the ledger better.`}
    >
      <Section title="How to reach us">
        <div className="not-prose grid gap-4 sm:grid-cols-2">
          {REASONS.map((r) => {
            const address = SITE[r.to]
            const todo = isTodo(address)
            return (
              <div key={r.title} className="border border-parchment bg-paper p-5">
                <h3 className="font-display text-xl">{r.title}</h3>
                <p className="mt-2 text-sm text-ink/65">{r.body}</p>
                {todo ? (
                  <p className="mt-4 bg-crimson/10 px-2 py-1 font-mono text-xs text-crimson">
                    {address}
                  </p>
                ) : (
                  <a
                    href={`mailto:${address}?subject=${encodeURIComponent(`[${SITE.name}] ${r.title}`)}`}
                    className="mt-4 inline-block border border-ink px-4 py-2 transition-colors hover:bg-ink hover:text-cream"
                  >
                    <Eyebrow>{address}</Eyebrow>
                  </a>
                )}
              </div>
            )
          })}
        </div>
        <p className="mt-6 text-sm text-ink/55">
          There is no contact form here on purpose: the site has no backend, and a form that
          silently fails is worse than an address that works.
        </p>
      </Section>

      <Section title="Who runs it">
        <p>
          {SITE.name} is operated by <Value of="legalEntity" />, at <Value of="address" />.
        </p>
      </Section>

      <Section title="Response times">
        <p>
          This is not a staffed newsroom, so allow a few days for a reply. Copyright and privacy
          requests are handled first.
        </p>
      </Section>
    </LegalPage>
  )
}

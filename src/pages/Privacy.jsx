import { Link } from 'react-router-dom'
import { LegalPage, Section, Value } from '../components/Legal.jsx'
import { SITE } from '../lib/site.js'
import { useConsent } from '../lib/consent.js'
import { Eyebrow } from '../components/Primitives.jsx'
import { formatDate } from '../lib/format.js'

/** Lets a reader see and change their actual stored choice, not just read about it. */
function YourChoices() {
  const { decided, choices, decidedAt } = useConsent()

  return (
    <div className="border border-parchment bg-paper p-5">
      <Eyebrow className="text-gold">Your current choice</Eyebrow>
      {decided ? (
        <>
          <ul className="mt-3 space-y-1 text-sm">
            <li>
              Analytics cookies:{' '}
              <strong>{choices.analytics ? 'allowed' : 'declined'}</strong>
            </li>
            <li>
              Advertising cookies:{' '}
              <strong>{choices.advertising ? 'allowed' : 'declined'}</strong>
            </li>
          </ul>
          <p className="mt-2 text-xs text-ink/45">Recorded {formatDate(decidedAt)}</p>
        </>
      ) : (
        <p className="mt-3 text-sm text-ink/70">
          You have not made a choice yet, so nothing optional is running.
        </p>
      )}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent('hoopspire:open-consent'))}
        className="mt-4 border border-ink px-4 py-2 transition-colors hover:bg-ink hover:text-cream"
      >
        <Eyebrow>Change cookie settings</Eyebrow>
      </button>
    </div>
  )
}

export default function Privacy() {
  return (
    <LegalPage
      kicker="Legal"
      title="Privacy Policy"
      intro={`This policy explains what ${SITE.name} does — and does not — do with your data. The short version: there are no accounts, nothing is tracked until you say yes, and the only personal data we ever hold is an email address you chose to give us.`}
    >
      <YourChoices />

      <Section title="Who we are">
        <p>
          {SITE.name} ({SITE.domain}) is operated by <Value of="legalEntity" />, at{' '}
          <Value of="address" />. For anything in this policy, write to{' '}
          <a href={`mailto:${SITE.privacyEmail}`}>
            <Value of="privacyEmail" />
          </a>
          . Under the GDPR, that operator is the data controller for this site.
        </p>
      </Section>

      <Section title="What we collect">
        <p>
          <strong>No accounts.</strong> There is no login and no profile. We never ask for your
          name, payment details or date of birth, and no page on this site requests them. The only
          personal data you can give us is an email address, and only by choosing to.
        </p>
        <p>
          <strong>Your consent choice.</strong> When you answer the cookie banner, the answer is
          saved in your own browser's local storage. It stays on your device, is never transmitted
          to us, and we cannot read it.
        </p>
        <p>
          <strong>Server logs.</strong> Whoever hosts this site will keep standard access logs (IP
          address, browser type, page requested, timestamp) as an ordinary part of serving the
          page. These are used for security and troubleshooting only.
        </p>
        <p>
          <strong>Newsletter signups.</strong> If — and only if — you enter your email address
          and tick the consent box, that address is sent to our email provider so we can send you
          the newsletter. We ask for nothing else: no name, no location. Every issue carries an
          unsubscribe link, and unsubscribing deletes you from the list. We do not sell, rent or
          share the list.
        </p>
        <p>
          <strong>Optional analytics and advertising.</strong> Only if you allow them. See below.
        </p>
      </Section>

      <Section title="Cookies and similar technologies">
        <p>
          We use three categories, and only the first is active by default:
        </p>
        <ul>
          <li>
            <strong>Strictly necessary</strong> — just the record of your consent choice. No
            permission is needed for this, and it is not used to track you.
          </li>
          <li>
            <strong>Analytics</strong> — aggregate page-view counts so we can see which leagues
            people actually read. Off unless you allow it.
          </li>
          <li>
            <strong>Advertising</strong> — lets advertising partners set cookies and show ads,
            including ads selected based on your interests. Off unless you allow it.
          </li>
        </ul>
        <p>
          Nothing in the optional categories loads before you consent. If you decline, no
          advertising or analytics script is fetched at all — not blocked after the fact, but never
          requested. You can change or withdraw your choice at any time from the button above or
          the "Cookie settings" link in the footer, and withdrawing is exactly as easy as giving it.
        </p>
      </Section>

      <Section title="Advertising partners">
        <p>
          If advertising is enabled on this site and you have consented, third-party vendors may
          set cookies and use device identifiers to serve and measure ads. Where Google is used as
          a vendor, Google's use of advertising cookies enables it and its partners to serve ads
          based on your visits to this and other sites. You can opt out of personalised advertising
          in{' '}
          <a href="https://www.google.com/settings/ads" target="_blank" rel="noreferrer">
            Google Ads Settings
          </a>
          , or opt out of third-party vendors' use of cookies at{' '}
          <a href="https://www.aboutads.info/choices/" target="_blank" rel="noreferrer">
            aboutads.info/choices
          </a>
          .
        </p>
      </Section>

      <Section title="Where the sports data comes from">
        <p>
          Scores, standings, fixtures and rosters are fetched from publicly available feeds
          published by the competitions and their media partners, and from public encyclopaedic
          sources. Headlines link out to the original publisher.
        </p>
        <p>
          Some of these requests are made directly by your browser, which means those providers
          will see your IP address and browser information as they would for any site you visit.
          They are independent controllers of that data under their own privacy policies. The full
          list of sources is on the{' '}
          <Link to="/about">Ledger</Link> page.
        </p>
      </Section>

      <Section title="Affiliate links">
        <p>
          Some articles link to retailers through affiliate programmes, which means we may earn a
          commission if you buy something after following one. Those links are marked in the page
          source as <code className="font-mono text-xs">sponsored</code>, and any article
          containing one carries a visible disclosure at the top — before you reach the link, not
          after.
        </p>
        <p>
          Following such a link takes you to the retailer, who may set their own cookies under
          their own privacy policy. A commission never changes what we write, and it never
          changes a reported score or statistic.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          Depending on where you live, you may have the right to access, correct, delete, port or
          restrict processing of your personal data, to object to processing, and to lodge a
          complaint with your data protection authority. Under the GDPR, our legal basis for the
          optional categories is your consent; for server logs it is our legitimate interest in
          keeping the site running and secure.
        </p>
        <p>
          If you are in California, we do not sell or share personal information as those terms are
          defined by the CCPA/CPRA, and we do not knowingly collect data from anyone under 16.
        </p>
        <p>
          For the newsletter specifically, the fastest route is the unsubscribe link in any
          issue. Otherwise, email{' '}
          <a href={`mailto:${SITE.privacyEmail}`}>
            <Value of="privacyEmail" />
          </a>
          . Because we hold no account data, we may be unable to identify data as yours — in which
          case we will say so rather than guess.
        </p>
      </Section>

      <Section title="Children">
        <p>
          This site is not directed at children under 13, and we do not knowingly collect their
          personal data. If you believe a child has provided us data, contact us and we will delete
          it.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          If this policy changes materially we will update the date at the top and, where the
          change affects consent, ask you again.
        </p>
      </Section>
    </LegalPage>
  )
}

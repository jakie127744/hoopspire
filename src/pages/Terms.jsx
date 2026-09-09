import { Link } from 'react-router-dom'
import { LegalPage, Section, Value } from '../components/Legal.jsx'
import { SITE } from '../lib/site.js'

export default function Terms() {
  return (
    <LegalPage
      kicker="Legal"
      title="Terms of Use"
      intro={`By using ${SITE.name} you agree to these terms. They are deliberately short and plain.`}
    >
      <Section title="What this site is">
        <p>
          {SITE.name} is an independent basketball reference and news index. It is not affiliated
          with, endorsed by, or sponsored by the NBA, WNBA, FIBA, EuroLeague, PBA, KBL, B.League,
          NBL, NCAA, or any other league, club or broadcaster named on it. All league names, club
          names, logos and trademarks belong to their respective owners and are used here only to
          identify the competitions being reported on.
        </p>
      </Section>

      <Section title="Accuracy">
        <p>
          Scores, standings, fixtures and rosters are pulled from third-party feeds and may be
          delayed, incomplete or wrong. Where a source is unavailable, the site says so rather than
          filling the gap. Nothing here is official. Do not rely on it for anything that matters —
          and in particular, do not rely on it for betting or wagering decisions.
        </p>
      </Section>

      <Section title="Third-party content">
        <p>
          News items show a headline, a short extract and a byline, and link to the original
          publisher. Copyright in those articles remains with the publisher. We do not reproduce
          full articles. If you own content indexed here and want it removed, see the takedown
          section below and it will be removed promptly.
        </p>
        <p>
          Some material is drawn from Wikipedia and is available under the{' '}
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/"
            target="_blank"
            rel="noreferrer"
          >
            Creative Commons Attribution-ShareAlike 4.0
          </a>{' '}
          licence. Sources are listed on the <Link to="/about">Ledger</Link> page.
        </p>
      </Section>

      <Section title="Acceptable use">
        <p>You agree not to:</p>
        <ul>
          <li>scrape, mirror or bulk-download the site in a way that burdens it;</li>
          <li>present the content as your own or strip attribution;</li>
          <li>attempt to break, probe or interfere with the site or its hosting;</li>
          <li>use the site for anything unlawful.</li>
        </ul>
      </Section>

      <Section title="No warranty and limitation of liability">
        <p>
          The site is provided "as is" and "as available", without warranties of any kind, express
          or implied, including fitness for a particular purpose and non-infringement. To the
          fullest extent permitted by law, <Value of="legalEntity" /> is not liable for any
          indirect, incidental or consequential loss arising from your use of the site, including
          loss arising from reliance on inaccurate data.
        </p>
        <p>
          Nothing in these terms limits liability that cannot lawfully be limited, including for
          death or personal injury caused by negligence, or for fraud.
        </p>
      </Section>

      <Section title="Copyright and takedown">
        <p>
          We respect copyright. If you believe material on this site infringes your rights, email{' '}
          <a href={`mailto:${SITE.email}`}>
            <Value of="email" />
          </a>{' '}
          identifying the material, the page it appears on, and your rights in it. Valid claims are
          actioned promptly, usually by removing the item.
        </p>
      </Section>

      <Section title="Changes and governing law">
        <p>
          These terms may change; the date at the top will be updated. They are governed by the
          laws of <Value of="jurisdiction" />, and disputes are subject to the courts of that
          jurisdiction.
        </p>
      </Section>
    </LegalPage>
  )
}

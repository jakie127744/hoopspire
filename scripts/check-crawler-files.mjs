/**
 * Fails the build if a crawler-facing file did not make it into dist/.
 *
 * This exists because of how the Worker serves misses. `not_found_handling:
 * "single-page-application"` answers any unknown path with index.html and
 * HTTP 200 — which is right for /scores and catastrophic for /ads.txt. A
 * missing ads.txt does not 404. It returns a basketball site with a 200, and
 * Google parses that HTML as an ads.txt containing zero valid records, which
 * it reports as "no ads.txt found".
 *
 * That failure is invisible from the outside: the URL loads, the status is
 * 200, and the only symptom is an AdSense warning days later. So the build
 * refuses to ship without these files rather than letting the fallback hide
 * their absence.
 *
 * Run against a deployed site with --live to check the same things over the
 * wire, where a CDN, a redirect or a bot challenge can still break what the
 * build got right:
 *
 *   node scripts/check-crawler-files.mjs --live https://hoopspire.com
 */
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const liveFlag = process.argv.indexOf('--live')
const origin = liveFlag !== -1 ? process.argv[liveFlag + 1]?.replace(/\/$/, '') : null

/** An ads.txt data row: domain, publisher id, relationship[, cert id]. */
const ADS_RECORD = /^[^\s,#]+\s*,\s*[^\s,]+\s*,\s*(DIRECT|RESELLER)\s*(,\s*[^\s,]+)?\s*$/i

const CHECKS = [
  {
    path: '/ads.txt',
    type: 'text/plain',
    validate(body) {
      const records = body
        .split(/\r?\n/)
        .map((l) => l.replace(/#.*$/, '').trim())
        .filter(Boolean)
        .filter((l) => !l.toLowerCase().startsWith('contact=') && !l.includes('='))
      if (!records.length) return 'no data records'
      const bad = records.filter((r) => !ADS_RECORD.test(r))
      if (bad.length) return `unparseable record: ${bad[0]}`
      return null
    },
  },
  { path: '/robots.txt', type: 'text/plain', validate: (b) => (/user-agent:/i.test(b) ? null : 'no User-agent line') },
  { path: '/sitemap.xml', type: 'xml', validate: (b) => (b.includes('<urlset') ? null : 'no <urlset>') },
]

/** Read from dist/, or over the wire when --live gave us an origin. */
async function fetchBody({ path, type }) {
  if (!origin) {
    return { body: await readFile(join(root, 'dist', path.slice(1)), 'utf8') }
  }
  const res = await fetch(`${origin}${path}`, { redirect: 'follow' })
  const body = await res.text()
  const ct = res.headers.get('content-type') || ''
  const problems = []
  if (!res.ok) problems.push(`HTTP ${res.status}`)
  // The tell-tale symptom: a 200 that is actually the SPA shell.
  if (/^\s*<!doctype html/i.test(body)) problems.push('served the app shell, not the file')
  if (!ct.includes(type)) problems.push(`content-type is "${ct}", expected ${type}`)
  return { body, problems }
}

let failed = false
for (const check of CHECKS) {
  let body, problems
  try {
    ;({ body, problems = [] } = await fetchBody(check))
  } catch (err) {
    console.error(`  ✘ ${check.path} — ${err.code === 'ENOENT' ? 'missing from dist/' : err.message}`)
    failed = true
    continue
  }
  const invalid = check.validate(body)
  if (invalid) problems.push(invalid)
  if (problems.length) {
    console.error(`  ✘ ${check.path} — ${problems.join('; ')}`)
    failed = true
  } else {
    console.log(`  ✓ ${check.path}`)
  }
}

if (failed) {
  console.error(
    origin
      ? '\nThe deployed site is not serving these correctly. A 200 that returns the app\nshell means the file is absent and the SPA fallback is covering for it.'
      : '\nRefusing to ship: the SPA fallback would serve these as HTML with a 200,\nand Google would read that as an ads.txt with no records.'
  )
  process.exit(1)
}
console.log(`crawler files OK${origin ? ` — ${origin}` : ''}`)

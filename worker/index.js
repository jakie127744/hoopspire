/**
 * The Hoopspire Worker.
 *
 * Almost everything this site serves is static and never reaches this file:
 * wrangler.jsonc routes only /api/* here (`run_worker_first`), and every
 * other request is answered straight from dist/ by the asset server. So this
 * is not an application server. It is one small endpoint.
 *
 * Reactions
 *
 *   GET  /api/reactions/:slug   -> { slug, counts: { fire: 3, data: 0, ... } }
 *   POST /api/reactions/:slug   body { add?: key, remove?: key } -> same shape
 *
 * What is stored is a count per article per reaction, and nothing else. No
 * IP address, no cookie, no identifier of any kind — which is why this needs
 * no login and no change to what the privacy policy says we collect. The
 * cost of that is that the server cannot tell one reader from another, so
 * "one reaction per reader" is kept by the reader's own browser, and the
 * server's job is only to keep the numbers from being farmed: a per-address
 * rate limit (the address is checked in memory by Cloudflare and never
 * written anywhere), a same-origin check, and a refusal to count anything
 * against an article that does not exist.
 */
import { REACTION_KEYS } from '../src/lib/reactions.js'

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  // Counts change with every click; a cached count would show a reader their
  // own reaction missing from the total they just added it to.
  'cache-control': 'no-store',
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })

/*
 * The table is created on first use rather than by a migration step, because
 * this site deploys from a git push and nothing in that path would run one.
 * CREATE TABLE IF NOT EXISTS is idempotent, and it runs once per isolate.
 * The schema lives here and nowhere else.
 */
let schemaReady = null
function ensureSchema(db) {
  schemaReady ??= db
    .prepare(
      'CREATE TABLE IF NOT EXISTS reactions (slug TEXT NOT NULL, reaction TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (slug, reaction))'
    )
    .run()
    .catch((err) => {
      schemaReady = null // let the next request try again
      throw err
    })
  return schemaReady
}

/*
 * Which articles exist. Read from the sitemap the build already writes — the
 * build refuses to ship without it — so the Worker never needs its own copy
 * of the article list, and a draft (absent from the sitemap) cannot collect
 * reactions before it is published.
 */
let slugCache = { at: 0, slugs: null }
async function knownSlugs(env, requestUrl) {
  if (slugCache.slugs && Date.now() - slugCache.at < 5 * 60_000) return slugCache.slugs
  const res = await env.ASSETS.fetch(new URL('/sitemap.xml', requestUrl))
  const xml = res.ok ? await res.text() : ''
  const slugs = new Set([...xml.matchAll(/\/story\/([^<\s]+)<\/loc>/g)].map((m) => m[1]))
  slugCache = { at: Date.now(), slugs }
  return slugs
}

async function readCounts(db, slug) {
  const { results } = await db
    .prepare('SELECT reaction, count FROM reactions WHERE slug = ?')
    .bind(slug)
    .all()
  const counts = Object.fromEntries(REACTION_KEYS.map((k) => [k, 0]))
  for (const row of results) {
    if (row.reaction in counts) counts[row.reaction] = row.count
  }
  return counts
}

async function react(request, env, slug) {
  // A browser always sends Origin on a cross-site POST. Refusing a foreign one
  // stops another page from spending its visitors' clicks on our counts. It
  // does not stop curl, which is what the rate limit is for.
  const origin = request.headers.get('origin')
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return json({ error: 'cross-origin requests are not accepted' }, 403)
  }

  if (env.REACTIONS_LIMIT) {
    const key = request.headers.get('cf-connecting-ip') || 'unknown'
    const { success } = await env.REACTIONS_LIMIT.limit({ key })
    if (!success) return json({ error: 'too many reactions, slow down' }, 429)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'body must be JSON' }, 400)
  }

  const add = body?.add ?? null
  const remove = body?.remove ?? null
  const valid = (k) => k === null || REACTION_KEYS.includes(k)
  if (!valid(add) || !valid(remove) || (add === null && remove === null) || add === remove) {
    return json({ error: `add and remove must be different keys from: ${REACTION_KEYS.join(', ')}` }, 400)
  }

  // One batch, so switching from one reaction to another is a single atomic
  // change — never a moment where the reader's reaction is counted twice or
  // not at all. MAX(..., 0) keeps a stale browser from driving a count negative.
  const statements = []
  if (remove) {
    statements.push(
      env.DB.prepare(
        'UPDATE reactions SET count = MAX(count - 1, 0) WHERE slug = ? AND reaction = ?'
      ).bind(slug, remove)
    )
  }
  if (add) {
    statements.push(
      env.DB.prepare(
        'INSERT INTO reactions (slug, reaction, count) VALUES (?, ?, 1) ON CONFLICT (slug, reaction) DO UPDATE SET count = count + 1'
      ).bind(slug, add)
    )
  }
  await env.DB.batch(statements)

  return json({ slug, counts: await readCounts(env.DB, slug) })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // Only /api/* is routed here, but answer anything else correctly anyway.
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request)

    const match = url.pathname.match(/^\/api\/reactions\/([A-Za-z0-9-]{1,120})\/?$/)
    if (!match) return json({ error: 'not found' }, 404)
    const slug = match[1]

    if (request.method !== 'GET' && request.method !== 'POST') {
      return new Response(null, { status: 405, headers: { allow: 'GET, POST' } })
    }

    try {
      if (!(await knownSlugs(env, request.url)).has(slug)) {
        return json({ error: 'no such article' }, 404)
      }
      await ensureSchema(env.DB)
      if (request.method === 'POST') return await react(request, env, slug)
      return json({ slug, counts: await readCounts(env.DB, slug) })
    } catch (err) {
      console.error('reactions failed', err)
      return json({ error: 'reactions are unavailable right now' }, 500)
    }
  },
}

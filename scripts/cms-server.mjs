/**
 * Hoopspire CMS — a local editor for content/articles/*.md
 *
 *   npm run cms      →  http://127.0.0.1:5180
 *
 * Deliberately small and local-only. It reads and writes the same Markdown
 * files the site already builds from, so there is no database, no separate
 * content store, and nothing to migrate later: whatever you write here is a
 * plain file in the repo.
 *
 * Safety properties, since this process writes to disk:
 *   - binds to 127.0.0.1 only, so it is never exposed on the network;
 *   - slugs are restricted to [a-z0-9-], and every resolved path is checked to
 *     be inside content/articles before any write or delete;
 *   - deletes move the file to content/articles/.trash rather than unlinking,
 *     so a misclick is recoverable.
 *
 * It has no authentication, because it is not meant to be reachable by anyone
 * but you. Do not put it on a public host — for that, use the git-based CMS
 * described in the README instead.
 */
import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const ARTICLES = path.join(ROOT, 'content', 'articles')
const TRASH = path.join(ARTICLES, '.trash')
const ADMIN_HTML = path.join(__dirname, 'cms', 'admin.html')

const PORT = Number(process.env.CMS_PORT || 5180)
const HOST = '127.0.0.1'

// Leading underscore and capitals are allowed so `_TEMPLATE.md` is editable.
// Crucially there are no dots and no slashes, so a slug cannot express a
// traversal on its own — and the path-relative check below is the real
// guarantee regardless.
const SLUG_RE = /^[_A-Za-z0-9][A-Za-z0-9_-]*$/

/** Resolve a slug to a path, refusing anything that escapes the content dir. */
function articlePath(slug) {
  if (!SLUG_RE.test(slug)) throw new Error(`invalid slug: ${slug}`)
  const file = path.join(ARTICLES, `${slug}.md`)
  const rel = path.relative(ARTICLES, file)
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('path escape refused')
  return file
}

function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!m) return { data: {}, body: raw }
  const data = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z][\w-]*)\s*:\s*(.*)$/)
    if (!kv) continue
    let v = kv[2].trim().replace(/^["'](.*)["']$/, '$1')
    if (v === 'true') v = true
    else if (v === 'false') v = false
    data[kv[1]] = v
  }
  return { data, body: m[2] }
}

const FIELD_ORDER = [
  'title',
  'dek',
  'league',
  'author',
  'published',
  'tag',
  'image',
  'imageCredit',
  'draft',
]

function serialise({ data, body }) {
  const lines = ['---']
  for (const key of FIELD_ORDER) {
    const v = data[key]
    if (v === undefined || v === null || v === '') continue
    // Quote anything with a colon so the frontmatter stays unambiguous.
    const needsQuotes = typeof v === 'string' && /:\s/.test(v)
    lines.push(`${key}: ${needsQuotes ? JSON.stringify(v) : v}`)
  }
  lines.push('---', '', String(body || '').trim(), '')
  return lines.join('\n')
}

async function listArticles() {
  await fs.mkdir(ARTICLES, { recursive: true })
  const names = (await fs.readdir(ARTICLES)).filter((f) => f.endsWith('.md'))
  const out = []
  for (const name of names) {
    const raw = await fs.readFile(path.join(ARTICLES, name), 'utf8')
    const { data, body } = parseFrontmatter(raw)
    const slug = name.replace(/\.md$/, '')
    out.push({
      slug,
      title: data.title || slug,
      league: data.league || '',
      author: data.author || '',
      published: data.published || '',
      tag: data.tag || '',
      draft: data.draft === true,
      words: body.trim().split(/\s+/).filter(Boolean).length,
      template: slug.startsWith('_'),
    })
  }
  out.sort((a, b) => String(b.published).localeCompare(String(a.published)))
  return out
}

const json = (res, code, payload) => {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(payload))
}

async function readBody(req) {
  const chunks = []
  for await (const c of req) chunks.push(c)
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`)
  const { pathname } = url

  try {
    if (pathname === '/' || pathname === '/index.html') {
      const html = await fs.readFile(ADMIN_HTML, 'utf8')
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      return res.end(html)
    }

    if (pathname === '/api/articles' && req.method === 'GET') {
      return json(res, 200, await listArticles())
    }

    if (pathname.startsWith('/api/article/')) {
      const slug = decodeURIComponent(pathname.slice('/api/article/'.length))

      if (req.method === 'GET') {
        const raw = await fs.readFile(articlePath(slug), 'utf8')
        const { data, body } = parseFrontmatter(raw)
        return json(res, 200, { slug, data, body })
      }

      if (req.method === 'PUT') {
        const { data, body, renameTo } = await readBody(req)
        const target = renameTo && renameTo !== slug ? renameTo : slug
        const file = articlePath(target)

        if (target !== slug) {
          // Refuse to silently clobber an existing piece on rename.
          const exists = await fs.access(file).then(() => true).catch(() => false)
          if (exists) return json(res, 409, { error: `${target}.md already exists` })
        }

        await fs.mkdir(ARTICLES, { recursive: true })
        await fs.writeFile(file, serialise({ data, body }), 'utf8')
        if (target !== slug) await fs.rm(articlePath(slug), { force: true })

        return json(res, 200, { ok: true, slug: target })
      }

      if (req.method === 'DELETE') {
        // Move to .trash instead of unlinking, so this is recoverable.
        await fs.mkdir(TRASH, { recursive: true })
        const stamp = new Date().toISOString().replace(/[:.]/g, '-')
        await fs.rename(articlePath(slug), path.join(TRASH, `${slug}.${stamp}.md`))
        return json(res, 200, { ok: true, trashed: true })
      }
    }

    if (pathname === '/api/leagues' && req.method === 'GET') {
      const src = await fs.readFile(path.join(ROOT, 'src', 'lib', 'leagues.js'), 'utf8')
      const keys = [...src.matchAll(/key:\s*'([^']+)'/g)].map((m) => m[1])
      return json(res, 200, keys)
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not found')
  } catch (err) {
    json(res, 400, { error: err.message })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`\n  Hoopspire CMS  →  http://${HOST}:${PORT}`)
  console.log(`  Editing        →  ${path.relative(ROOT, ARTICLES)}`)
  console.log(`  Local only. Ctrl+C to stop.\n`)
})

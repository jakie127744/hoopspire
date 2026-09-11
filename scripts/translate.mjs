/**
 * Headline translation for non-English news sources.
 *
 * Uses the MyMemory public API (api.mymemory.translated.net): free, keyless,
 * documented for anonymous use, with a daily character quota. Headlines are
 * short, so a full run uses a small fraction of it — and every translation is
 * cached on disk, so re-running the scraper only translates headlines it has
 * not seen before.
 *
 * Machine translation is not the publisher's own English. Every translated
 * item keeps its original text and is marked `translatedFrom`, so the UI can
 * say so rather than present a machine rendering as the source's words.
 *
 * If translation fails — quota exhausted, service down — the original text is
 * returned untouched. A headline in Portuguese is better than a missing one,
 * and far better than a guessed one.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CACHE_FILE = path.join(__dirname, '.cache', 'translations.json')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let cache = null
let dirty = false

async function loadCache() {
  if (cache) return cache
  try {
    cache = JSON.parse(await fs.readFile(CACHE_FILE, 'utf8'))
  } catch {
    cache = {}
  }
  return cache
}

export async function saveTranslationCache() {
  if (!dirty || !cache) return
  await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true })
  await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2))
  dirty = false
}

/**
 * Translate one string. `from` is an ISO code: 'pt', 'zh-TW', 'ja', 'ko'.
 * @returns {{ text: string, translated: boolean }}
 */
export async function translate(text, from) {
  const source = String(text || '').trim()
  if (!source) return { text: source, translated: false }

  const c = await loadCache()
  const key = `${from}|${source}`
  if (c[key]) return { text: c[key], translated: true }

  const url =
    'https://api.mymemory.translated.net/get?' +
    new URLSearchParams({ q: source.slice(0, 480), langpair: `${from}|en` })

  try {
    const res = await fetch(url)
    const body = await res.json()
    const out = body?.responseData?.translatedText

    // MyMemory reports an exhausted quota inside a 200 response, as text.
    const quotaHit =
      body?.quotaFinished || /MYMEMORY WARNING|QUOTA/i.test(String(out || ''))

    if (!res.ok || quotaHit || !out) return { text: source, translated: false }

    c[key] = out
    dirty = true
    await sleep(250)
    return { text: out, translated: true }
  } catch {
    return { text: source, translated: false }
  }
}

/** Human-readable name for the `translatedFrom` label. */
export const LANGUAGE_NAMES = {
  pt: 'Portuguese',
  'zh-TW': 'Chinese',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
}

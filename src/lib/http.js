/**
 * Fetching with a deadline, and a short memory of what just failed.
 *
 * Two opposite failures lived in this codebase, and this module is the cure
 * for both.
 *
 * No deadline. A browser `fetch` has no timeout of its own, so a feed that
 * accepts the connection and then goes quiet leaves the promise pending for
 * minutes. useAsync awaits each refresh before scheduling the next, so one
 * such request stopped live polling for the rest of the visit, with the last
 * score frozen on screen and nothing saying so.
 *
 * No sense of proportion about failure. The ESPN and EuroLeague adapters
 * cached only successes, so a feed that was down got asked again on every
 * refresh by every reader. The snapshot and player loaders did the reverse,
 * caching the failed promise forever, so one dropped connection emptied a
 * league until a full reload. Both now go through `noteFailure`: after a
 * failure a URL is left alone for a while, and then asked again.
 */

const DEFAULT_TIMEOUT_MS = 10_000

/** Waits between retries of a failing URL, lengthening as failures repeat. */
const BACKOFF_MS = [15_000, 60_000, 5 * 60_000]

/** An AbortSignal that fires after `ms`, including where AbortSignal.timeout is missing. */
function timeoutSignal(ms) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms)
  }
  const controller = new AbortController()
  setTimeout(() => controller.abort(), ms)
  return controller.signal
}

/** `fetch`, but it gives up after `ms` rather than waiting forever. */
export function fetchWithTimeout(url, options = {}, ms = DEFAULT_TIMEOUT_MS) {
  return fetch(url, { ...options, signal: options.signal ?? timeoutSignal(ms) })
}

const failures = new Map()

/** True while a URL is inside its back-off window after failing. */
export function isBackingOff(url) {
  const f = failures.get(url)
  return !!f && Date.now() < f.until
}

export function noteFailure(url) {
  const count = (failures.get(url)?.count ?? 0) + 1
  const wait = BACKOFF_MS[Math.min(count - 1, BACKOFF_MS.length - 1)]
  failures.set(url, { count, until: Date.now() + wait })
}

export function noteSuccess(url) {
  failures.delete(url)
}

/** The error a caller sees when a URL is skipped rather than fetched. */
export class BackingOff extends Error {
  constructor(url) {
    super(`waiting before retrying ${url}`)
    this.name = 'BackingOff'
  }
}

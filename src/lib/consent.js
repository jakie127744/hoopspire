/**
 * Cookie / tracking consent.
 *
 * Nothing that sets a cookie or fingerprints a reader may run before the
 * reader has said yes. This module is the single gate: `useConsent()` reads
 * the stored decision, and components that load third-party scripts must check
 * it before doing anything.
 *
 * IMPORTANT — read before serving ads in the EEA/UK:
 * Google requires a *certified* Consent Management Platform from its published
 * CMP list for EEA/UK traffic when running AdSense. This module is a correct,
 * self-hosted consent gate and is fine for the rest of the world, but it is not
 * on that list. For EEA/UK, use Google's own Privacy & Messaging CMP (or
 * another certified one) and have it drive `setConsent()` here.
 */
import { useSyncExternalStore, useCallback } from 'react'

const STORAGE_KEY = 'hoopspire.consent.v1'

/**
 * Categories.
 *
 * `necessary` is not listed because nothing here is optional about it: the
 * site stores only this consent record itself, which needs no permission.
 */
export const CATEGORIES = [
  {
    key: 'analytics',
    label: 'Analytics',
    description:
      'Lets us count page views and see which leagues get read, so we know what to build next. Never used to identify you.',
  },
  {
    key: 'advertising',
    label: 'Advertising',
    description:
      'Allows advertising partners to set cookies and show ads, including ads chosen based on your interests.',
  },
]

const DENY_ALL = { analytics: false, advertising: false }
const ALLOW_ALL = { analytics: true, advertising: true }

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed.choices !== 'object') return null
    return { ...parsed, choices: { ...DENY_ALL, ...parsed.choices } }
  } catch {
    // Private mode, blocked storage, corrupted value — treat as "not asked".
    return null
  }
}

// A tiny store so every subscriber re-renders together when consent changes.
let snapshot = read()
const listeners = new Set()

function emit() {
  snapshot = read()
  for (const fn of listeners) fn()
}

function subscribe(fn) {
  listeners.add(fn)
  // Consent set in another tab should take effect here too.
  const onStorage = (e) => e.key === STORAGE_KEY && emit()
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(fn)
    window.removeEventListener('storage', onStorage)
  }
}

const getSnapshot = () => snapshot
const getServerSnapshot = () => null

export function setConsent(choices) {
  const record = {
    version: 1,
    decidedAt: new Date().toISOString(),
    choices: { ...DENY_ALL, ...choices },
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  } catch {
    // If we cannot persist the decision we must not act on it either — the
    // in-memory emit below still updates this page, and the banner will ask
    // again next visit, which is the safe direction to fail.
  }
  emit()
}

export const acceptAll = () => setConsent(ALLOW_ALL)
export const rejectAll = () => setConsent(DENY_ALL)

export function clearConsent() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* nothing to clear */
  }
  emit()
}

/**
 * @returns {{
 *   decided: boolean,
 *   choices: {analytics: boolean, advertising: boolean},
 *   decidedAt: string|null,
 *   allows: (key: string) => boolean,
 * }}
 */
export function useConsent() {
  const record = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const choices = record?.choices ?? DENY_ALL

  const allows = useCallback((key) => choices[key] === true, [choices])

  return {
    decided: !!record,
    decidedAt: record?.decidedAt ?? null,
    choices,
    allows,
  }
}

/** Imperative check for non-React callers. */
export const hasConsent = (key) => read()?.choices?.[key] === true

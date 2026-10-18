/*
 * Heritage Line, the scouting desk. Kept apart from articles.js, which only
 * Vite can load, so the article lint in scripts/new-article.mjs reads the
 * same lists the Story page prints.
 */

/**
 * Heritage Line's eligibility file, printed under every report. The words a
 * reader sees for each frontmatter value; `npm run lint:articles` rejects any
 * value not listed here.
 */
export const CONNECTIONS = {
  passport: 'Holds the passport',
  parent: 'Through a parent',
  grandparent: 'Through a grandparent',
  birth: 'Born there',
}
export const FIBA_STATUS = {
  local: 'Counts as a local player',
  naturalised: 'Would count as the naturalised player',
  pending: 'Not settled yet',
}

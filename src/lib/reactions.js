/**
 * The reactions a reader can leave on an article.
 *
 * Shared by the page and by the Worker in /worker, so the two cannot disagree
 * about what exists: the Worker rejects any key not listed here, and the page
 * only draws buttons for keys listed here.
 *
 * `key` is what the database stores. Change a label or an emoji freely; never
 * rename a key, or every count already stored under the old one is orphaned.
 * To retire a reaction, remove it here — its rows stay in the table, unread.
 */
export const REACTIONS = [
  { key: 'fire', emoji: '🔥', label: 'Great read' },
  { key: 'data', emoji: '📊', label: 'Good numbers' },
  { key: 'swish', emoji: '🎯', label: 'Nailed it' },
  { key: 'doubt', emoji: '🤔', label: 'Not convinced' },
]

export const REACTION_KEYS = REACTIONS.map((r) => r.key)

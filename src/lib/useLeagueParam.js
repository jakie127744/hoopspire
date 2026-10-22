import { useSearchParams } from 'react-router-dom'
import { getLeague } from './leagues.js'

/**
 * A page's league choice, kept in the address (?league=PBA) so the league
 * menu in the header can link straight to it and a reader can bookmark it.
 * 'ALL' (or any unknown value) clears it back to the page's own default.
 */
export function useLeagueParam(fallback) {
  const [params, setParams] = useSearchParams()
  const key = getLeague(params.get('league'))?.key || fallback
  const set = (next) => {
    const p = new URLSearchParams(params)
    if (next && next !== 'ALL') p.set('league', next)
    else p.delete('league')
    setParams(p, { replace: true, preventScrollReset: true })
  }
  return [key, set]
}

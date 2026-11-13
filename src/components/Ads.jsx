import AdSlot from './AdSlot.jsx'
import { SITE } from '../lib/site.js'
import { useConsent } from '../lib/consent.js'

/**
 * The ad positions, placed where ESPN places theirs:
 *
 *   LeaderboardAd  the banner under the scoreboard (728/970 wide on a
 *                  desktop, a 320×50/100 strip on a phone)
 *   RailAd         the box at the top of the right rail (300×250), and the
 *                  tall unit lower down it (300×600)
 *   FeedAd         an ad card in the story feed, every few stories
 *   InArticleAd    a break between paragraphs in a long article
 *   MultiplexAd    the grid of suggested content at the foot of a page
 *
 * They all draw on the two units in SITE.adSlots. The display unit is
 * responsive, so `format` only hints at the shape (horizontal, rectangle,
 * vertical) and AdSense picks the size. Each one is labelled
 * "Advertisement", sits apart from links and buttons, and reserves its
 * height so the page does not jump when it fills.
 *
 * With advertising declined they render nothing. The note saying ads are
 * off appears once, at the end of an article, rather than in every slot.
 */

const display = SITE.adSlots.square.id

/**
 * Development only: add ?adpreview to any local address to see every ad
 * position as a grey box of its reserved size, without loading the ad
 * network's script.
 */
const preview =
  import.meta.env.DEV && typeof window !== 'undefined' && /[?&]adpreview\b/.test(window.location.search)

/**
 * Whether ad positions should take any space. They need a network, and the
 * reader's consent to advertising; without both, the frame, the label and
 * all collapse to nothing rather than leaving an empty box.
 */
function useAdsOn() {
  const { allows } = useConsent()
  return preview || (!!SITE.adNetwork && !!SITE.adsensePublisherId && allows('advertising'))
}

/** The slot itself, or in preview a box showing where it goes. */
function Slot({ id = display, format, height }) {
  if (preview) {
    return (
      <div
        className="flex items-center justify-center rounded bg-parchment/70 text-xs font-bold uppercase tracking-wide text-ink/45"
        style={{ minHeight: height }}
      >
        Ad · {format}
      </div>
    )
  }
  return <AdSlot slotId={id} format={format} height={height} label={false} hideWhenDeclined />
}

function Label() {
  return (
    <p className="mb-1.5 text-center text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-ink/40">
      Advertisement
    </p>
  )
}

export function LeaderboardAd() {
  if (!useAdsOn()) return null
  return (
    <div className="border-b border-parchment bg-cream py-2 md:py-3">
      <div className="mx-auto w-full max-w-[970px] px-3">
        <Label />
        <Slot format="horizontal" height={90} />
      </div>
    </div>
  )
}

export function RailAd({ tall = false }) {
  if (!useAdsOn()) return null
  return (
    <div className="card p-3">
      <Label />
      <Slot format={tall ? 'vertical' : 'rectangle'} height={tall ? 600 : 250} />
    </div>
  )
}

export function FeedAd() {
  if (!useAdsOn()) return null
  return (
    <div className="card px-3 py-4">
      <Label />
      <div className="mx-auto max-w-[336px]">
        <Slot format="rectangle" height={250} />
      </div>
    </div>
  )
}

export function InArticleAd() {
  if (!useAdsOn()) return null
  return (
    <aside aria-label="Advertisement" className="not-prose my-10 border-y border-parchment py-5">
      <Label />
      <div className="mx-auto max-w-[336px]">
        <Slot format="rectangle" height={250} />
      </div>
    </aside>
  )
}

export function MultiplexAd() {
  const unit = SITE.adSlots.feed
  if (!useAdsOn()) return null
  return (
    <div className="card p-4">
      <Label />
      <Slot id={unit.id} format={unit.format} height={300} />
    </div>
  )
}

/** Put a FeedAd after every `every` items of a feed, never last. */
export function withFeedAds(items, render, every = 4) {
  const out = []
  items.forEach((item, i) => {
    out.push(render(item, i))
    if ((i + 1) % every === 0 && i < items.length - 1) out.push(<FeedAd key={`ad-${i}`} />)
  })
  return out
}

---
title: Headline goes here
dek: One or two sentences of standfirst. This is what shows on cards and in search results, so make it say something.
league: NBA
author: Your Name
published: 2026-09-09
tag: Analysis
image: https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1600&q=80
imageCredit: Photo by Unsplash
draft: true
---

Copy this file, rename it, and delete `draft: true` when you want it live.
The filename becomes the URL — `my-article.md` publishes at `/story/my-article`
— so keep it lowercase with hyphens.

## Frontmatter fields

- **title** — the headline.
- **dek** — the standfirst. Shows on cards and as the page's meta description.
- **league** — a key from `src/lib/leagues.js` (`NBA`, `PBA`, `KBL`, `BLeague`,
  `EuroLeague`, `CBA`, `TPBL`, `FIBA`, `WNBA`, `GLeague`, `NCAAM`, `NBB`,
  `NBL`). The piece then appears on that league's page. Omit it entirely for a
  cross-league story.
- **author** — your byline.
- **published** — ISO date, `YYYY-MM-DD`. Controls ordering.
- **tag** — `Analysis`, `Feature`, `Report`, `Explainer`, `Interview`…
- **image** / **imageCredit** — optional hero. If you set an image, set the
  credit. See the note on rights below.
- **draft** — `true` hides the file from the site completely.

## Writing

Standard Markdown. Headings, **bold**, *italic*, [links](https://example.com),
lists, block quotes and tables are all styled to match the site:

> A pull quote looks like this — serif, italic, with a gold rule.

| Column | Value |
|---|---|
| Tables | are styled too |

## A note on images

Do not screenshot broadcasts, other sites, or wire photos. Writing your own
article around someone else's picture does not license the picture. Use your
own photography, a league press portal under its terms, properly attributed
Creative Commons, or a stock library — and always fill in `imageCredit`.

Text-only pieces are completely fine here. The card layout is designed to look
right without a hero image.

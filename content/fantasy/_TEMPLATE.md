---
title: "Headline goes here"
dek: "One or two sentences of standfirst. This shows on cards and in search results, so make it say something."
league: "NBA"
author: "Franco Medina"
published: "2026-09-19"
tag: "Draft"
draft: true
---

This is the Free Minutes desk. Everything in `../articles/_TEMPLATE.md` about
frontmatter still applies, with two differences, both enforced by
`npm run lint:articles`.

**The directory decides the desk.** A file here appears on `/free-minutes`.
A file in `../articles` appears on `/margin`. There is no `desk:` frontmatter
field, deliberately: a typo in one would fail silently, because the site's
frontmatter parser never throws. Moving a piece between desks is a `git mv`.

**Tags are different here.** `Draft`, `Projections`, `Categories`, `Waivers`,
`Trades`, `Injuries`. The Margin's `Analysis`/`Data`/`Trends` vocabulary is
rejected by the lint on this desk, and vice versa. The reason is that a
fantasy tag has a job the Margin's tags do not: it tells a manager whether a
piece is worth reading in October or in February.

Scaffold a new one rather than copying this file:

```
npm run new -- "Your headline" --desk fantasy --tag Waivers
```

## What belongs here

NBA fantasy, argued from the numbers, for head-to-head categories, roto and
points leagues. The desk publishes one piece a day, and that cadence is
printed on the section page, so it is a promise rather than a target.

- **Write the minutes assumption down.** Every projection is a per-minute rate
  multiplied by a guess about playing time. A piece that hides the guess
  inside a ranking is the thing this desk exists to argue against.
- **Name the format.** The same player is a different asset in nine-cat roto
  and in points. Advice that does not say which one it is for is advice for
  somebody else's league.
- **Give a range where the minutes are uncertain,** and say how far the
  projection moves if the guess is wrong.
- **Use hypothetical players for worked arithmetic.** Do not put invented stat
  lines next to real names. Illustrative maths does not relax the rule against
  presenting estimated numbers as measured.
- **No betting content.** No odds, no tipping. This is analysis.

## What does not belong here

Game recaps, cross-league comparison, and anything not about the NBA. Those
are The Margin's, and the two desks are easy to blur precisely because both
are stats-first. The test: does the reader finish able to do something to
their roster? If not, it is a Margin piece.

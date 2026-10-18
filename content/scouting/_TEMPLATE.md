---
title: Headline that says who the player is and which national team
dek: One or two sentences. Where the player grows up and plays, the verified tie to the other country, and where FIBA's rules leave them.
league: FIBA
league2: NCAAM
nation: Philippines
connection: parent
status: pending
author: Amara Diallo
published: 2026-10-18
tag: Scouting Report
draft: true
---

Heritage Line: scouting reports on young players growing up outside the
country they could represent. Scaffold with:

    npm run new -- "Headline" --desk scouting --tag "Scouting Report"

Filing rules (checked by `npm run lint:articles` where marked):

- `league: FIBA` on every piece (lint). Set `league2` to the league the
  player plays in, so the piece also shows on that league page.
- `nation`: the national team the piece is about (lint: required).
- `connection`: `passport`, `parent`, `grandparent` or `birth` (lint). It must
  be verified from a federation, club, league or official roster record, or
  two independent reliable reports that agree. A surname or a rumour is not
  a connection, and an unverified player is not written up.
- `status` (lint): `local` if the player held that nationality before the age
  FIBA's eligibility rules set, `naturalised` if it was acquired later (a
  national team may field one such player), `pending` if it is not held yet
  or not confirmed. Check the current FIBA Internal Regulations, Book 3,
  before every piece; do not rely on an older summary of the age threshold.
- Tag says news or opinion (lint): `Scouting Report` and `Eligibility` are
  news, by Amara Diallo. `Second Look` (Victor Ashby, the Americas) and
  `Hot Hand` (Noor Haddad, everywhere else) are columns.

Young players: these are minors. Write only about what they do in public
competition and what official records show. No schools below university
level, no home towns finer than a city, no family members beyond the tie
that makes them eligible, no personal social media, no photos of minors
unless the federation or club published them for that use.

Every piece goes through the full editorial pipeline and both gates before
`draft: true` comes off.

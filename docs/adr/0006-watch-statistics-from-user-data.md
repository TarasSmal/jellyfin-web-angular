# 0006 — Watch statistics derived from per-item user data

**Status:** accepted (2026-08-23)

## Context

The admin dashboard needed server-wide viewing analytics: who watches, how
much, which genres and shows dominate, how much of the library is ever
touched.

Core Jellyfin keeps **no playback log**. There is no history endpoint, no
session archive, nothing that answers "what was played on the 4th of March".
What it keeps is a tally on each item, per account: `Played`, `PlayCount`,
`LastPlayedDate`, `PlaybackPositionTicks`. The activity log is close but is
retention-capped (30 days by default), records starts rather than durations,
and is designed for auditing, not counting.

The **Playback Reporting plugin** does keep real session rows — per-play
duration, device, client, exact timestamps — and exposes them under
`/user_usage_stats/…`. It is not installed on this server, only records from
its install date forward, and is a third-party dependency this client would
then partly require.

## Decision

Derive the report from per-item user data, and say so on the page.

- `WatchStatsApi.playedItems(userId)` reads `/Items?filters=IsPlayed` once per
  account, with images off and only the aggregation's fields on the wire.
  A rejected read (an account the token may not see) resolves to an empty
  history rather than failing the page.
- `entities/watch-report` folds those histories into one `ServerWatchStats`
  with a pure, `now`-injected function. All arithmetic is unit-tested; nothing
  in the fold touches HTTP or the clock.
- **Watch time is an estimate: `RunTimeTicks × PlayCount`.** The page states
  this in prose rather than presenting the number as measured.
- The page reads through a `resource()` keyed on the account list, not the
  usual single `httpResource` — a server-wide picture is inherently N reads.
  This is the one sanctioned exception to the read rule in `CLAUDE.md`.
- Per-account reads are capped at `PLAYED_ITEMS_LIMIT` (5,000, newest finish
  first). A truncated history is flagged in the UI, per account and globally.

## Consequences

- Works on any Jellyfin server, today, with no plugin and no install-date
  horizon: the numbers cover the library's whole life.
- Watch time overstates abandoned viewings (a film quit at 95 % counts whole)
  and understates partial ones that never completed (they are not `IsPlayed`
  at all, so they are invisible here). Fine for ranking genres and comparing
  accounts; not an audit trail, and it must never be presented as one.
- The activity chart is **last-finish dates, not a history**. A rewatch moves
  a title forward, so past months thin out as time passes. The chart is
  labelled accordingly; it is the one number on the page that decays.
- Cost scales with accounts × library size — N parallel reads on page load.
  Household-sized servers are the design point; the cap is the backstop.
- Reading another account's items requires admin rights, which is why this
  lives under `/admin` rather than as a personal stats page. A per-user
  version needs no new API — just one history instead of N.
- Adopting the Playback Reporting plugin later is additive: it would light up
  real durations, per-day/hour activity and device breakdowns beside these,
  and `ServerWatchStats` is the seam those would land behind.

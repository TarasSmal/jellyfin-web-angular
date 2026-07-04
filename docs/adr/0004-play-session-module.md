# 0004 — Play Session module owns the playback lifecycle

**Status:** accepted (2026-07-04)

## Context

The playback lifecycle was smeared across three places: the player page
assembled report DTOs and ran progress timers, a pass-through `play-item`
feature resolved streams, and `PlaybackApi` held the wire calls. Nothing owned
the domain's **Play Session** (one continuous playback attempt of one item,
identified by PlaySessionId). Consequences: a failed report error-screened a
playing video; the progress interval survived audio-switch restarts, so the
server received progress for a session already reported Stopped; and none of it
was testable without a real `<video>` against a live server. A future
mini-player was architecturally impossible — the lifecycle died with the page.

ADR 0003 showed the pattern: one deep module behind a small surface, wire
concerns sealed inside, tested via an injection-context factory.

## Decision

One deep module in `features/play-session`, created by `createPlaySession(itemId, surface)`
— both reactive inputs, no assumption about the host. It owns everything:
item fetch, stream resolution (Direct Play → Transcode → Direct Stream, folded
in from the deleted `play-item`), media attachment, resume, the 10-second
progress cadence, the audio-switch invariant, and teardown. State flows out
through read-only signals; callers act only through commands (toggle play,
seek, volume, mute, select audio/subtitle, stop). The PlaySessionId and
`ResolvedStream` appear on no public type.

- **Media attachment** sits behind a `MEDIA_ENGINE` port (injection token,
  HLS.js default) — the only file importing `hls.js`; tests pass a fake.
- **Reporting** goes through Issue 1's domain-shaped `SessionProgress` surface;
  the module fire-and-forgets, so a failed report never touches playback state.
- **Exactly-once Stopped** flows through a single end-session funnel used by
  explicit `stop()`, audio switch, item change, and host destruction. It nulls
  the active session first (idempotent), clears that session's own timer
  synchronously before Stopped, and bumps a generation counter that abandons
  in-flight async resolutions.
- **Audio switch** is one atomic single-flight command: the old session is
  honestly stopped (final sample, Stopped, timer cleared) strictly before the
  new one starts at the carried position.
- The player page becomes a thin host: renders the module's signals, forwards
  gestures as commands, keeps chrome, fullscreen, keyboard, and the
  ended-navigates-back policy. Ending policy is host policy.

## Consequences

- Pages never touch the playback API or wire streams/reports directly; a page
  wanting playback hosts a session. Enforced as a project rule.
- The module is tested at its interface with fake timers, a stub video surface,
  a spy reporting API, and a fake media engine — no browser, no live server.
- A future docked mini-player hosts the same session unchanged; this ADR only
  removes the obstacle (the overlay UI is out of scope).
- **Accepted behavior changes** (not regressions): a failed report no longer
  error-screens playback; an audio switch briefly re-mounts the stream (the old
  session is stopped first); changing the hosted item id cleanly restarts; and
  `ended` resets when the session rotates to a new item (it used to latch
  forever), so a reused host observes each item's ending exactly once.

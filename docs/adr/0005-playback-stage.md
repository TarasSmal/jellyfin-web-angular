# 0005 — One persistent Playback Stage; the route is the presentation

**Status:** accepted (2026-07-27)

## Context

ADR 0004 made the Play Session host-agnostic so a docked mini-player would
become possible, and left the overlay unbuilt. Building it ran into a hard
browser constraint: Angular destroying a `<video>` element restarts the stream
and opens a second server session. The player was a route, so every navigation
destroyed the element and `createPlaySession`'s teardown reported Stopped.

Re-parenting a live media element is actually safe (the spec's pause-on-removal
step requires reaching a stable state, which an atomic `appendChild` never
does), but its safety would hinge on Angular's teardown ordering. A second
constraint settled the shape: `requestFullscreen()` renders only its target's
subtree, so the video and the full-screen chrome must share an ancestor — the
chrome cannot stay behind in a routed page while the video lives elsewhere.

## Decision

One always-mounted **Playback Stage** owns the video element and hosts the Play
Session for the lifetime of one playback attempt. Full screen and docked are
two **presentations** of that one element: a class swap on its wrapper and an
`@if` swapping sibling chrome components. The video is declared outside every
`@if`, so no node is ever moved or re-created.

- **Presentation is derived from the router**, never stored: the player route
  means full screen, anything else means docked. Browser Back and Forward move
  the player with no bookkeeping, and there is no second source of truth to
  desynchronise.
- **`/player/:id` becomes intent only** — it declares the item and renders
  nothing, with no teardown hook. Leaving it changes the URL, which changes the
  presentation.
- **A `PlaybackController` holds what is playing** (item + commands) in its own
  feature slice. It types the registered session structurally (`{ stop(): void }`)
  rather than importing the playback module: the app root imports the
  controller, and a nominal import would drag hls.js into the initial bundle.
- **The outlet is `@defer`red** at the app root for the same reason; the
  chunk loads on first playback, as the lazy player route used to.
- **`play(id)` is idempotent for the item already playing.** That one guard is
  what makes pressing Play on the docked item expand the live session instead
  of restarting it at the last reported position.
- **`close()` stops the session synchronously**, before clearing the item —
  deferring to component teardown would lose the race against sign-out clearing
  the token, and the report would go out unauthenticated.
- The full-screen chrome, seek bar, Up Next card and the ending-policy models
  move from `pages/player` into the stage widget. ADR 0004 already made ending
  policy the host's; the host changed identity from page to widget, and a
  widget may not import a page.

## Consequences

- `play-session.ts` and `media-engine.ts` are untouched — ADR 0004's promise
  that "a future docked mini-player hosts the same session unchanged" holds
  literally. Its `DestroyRef` teardown becomes *more* honest: the session now
  ends when playback ends, not when a route changes.
- Document-level keyboard shortcuts live on the full-screen chrome, so they
  exist only while full screen. This is deliberate: a global handler would
  hijack Space while the viewer types in the header's search box. The dock gets
  its own scoped handling.
- The player route no longer owns fullscreen, chrome or teardown, so its page
  slice is nearly empty. Kept as a page because routes belong to pages.
- Playback does not survive a hard reload; progress reports keep Continue
  Watching correct. Tab close still reports nothing — unchanged from before,
  and a `sendBeacon` fix must route through the session's end funnel or it
  double-reports.
- Presentation derived from `currentNavigation()` flips at RoutesRecognized, so
  the shrink starts as the router commits; an abandoned navigation self-corrects
  through the fallback to the last successful one.

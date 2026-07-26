# PRD: Docked Mini-Player

## Problem Statement

Playback dies at the route boundary. The player is a full-screen route outside the app shell, so the moment the viewer navigates anywhere — back to the series, into a library, to search — the hosting component is destroyed, the video element goes with it, and the Play Session reports Stopped. There is no way to keep watching while browsing, no way to check what else is in a library without giving up the current title, and returning means finding the item again and resuming from the last reported position rather than the live one. Every competing client (YouTube, Netflix, Peacock, official jellyfin-web) keeps playback alive while the viewer browses.

The architecture has been ready for this since ADR 0004, which moved the whole playback lifecycle into a host-agnostic module precisely so "a future docked mini-player hosts the same session unchanged" — and explicitly left the overlay unbuilt.

## Solution

Playback outlives the route. Leaving the player shrinks the video into a small docked corner player that keeps playing, with minimal chrome: title, play/pause, a progress indicator, expand, and close. Clicking expand (or navigating back to the player URL) returns to full screen at the live position — the same server session, the same `PlaySessionId`, no re-buffer and no restart. Closing the dock ends playback the way stopping always has.

Mechanically, one always-mounted stage owns a single `<video>` element for the lifetime of one playback attempt. Full screen and docked are two presentations of that one element — a class swap on its wrapper and a swap of the sibling chrome component — so no DOM node is ever moved or re-created. The player route stops rendering the player and becomes a statement of intent: "this URL means play this item, full screen."

## User Stories

1. As a viewer, I want playback to continue when I navigate away from the player, so that I can browse the library without losing my place.
2. As a viewer, I want the video to shrink into a corner rather than disappear, so that I can keep watching while I browse.
3. As a viewer, I want to click the docked player to return to full screen, so that going back to watching is one gesture.
4. As a viewer, I want the expanded player to resume at the live position, not the last reported one, so that no seconds are lost or repeated.
5. As a viewer, I want the browser Back button to re-dock the player after I expand it, so that expanding and collapsing are symmetric.
6. As a viewer, I want play/pause on the docked player, so that I can pause without expanding.
7. As a viewer, I want to see what is playing (title, and the episode code for episodes), so that the dock is identifiable at a glance.
8. As a viewer, I want a progress indicator on the dock, so that I know how far along I am.
9. As a viewer, I want to close the docked player, so that I can stop playback without expanding it first.
10. As a viewer, I want the server to see one continuous session across the whole trip, so that resume points and the dashboard stay correct.
11. As a viewer, I want opening a different item while docked to swap cleanly to it, so that I never end up with two players or a ghost session.
12. As a viewer, I want playing the item that is already docked to expand it rather than restart it, so that I don't lose my position by pressing Play.
13. As a series viewer, I want auto-advance to keep working while docked, so that a binge survives browsing.
14. As a series viewer, I want the "Are you still watching?" guard to survive expanding and collapsing, so that the runaway protection is not reset by navigation.
15. As a viewer, I want the dock never to cover page content I am reading, so that browsing stays usable.
16. As a viewer, I want the dock to become a full-width bar on a phone, so that it is usable on a small screen.
17. As a viewer signing out, I want playback to stop and report cleanly, so that I leave no session running on the server.
18. As a viewer on the login or connect screen, I want no docked player, so that signed-out screens stay clean.
19. As a keyboard user, I want every docked control reachable and operable by keyboard, so that the dock is not mouse-only.
20. As a keyboard user, I want player shortcuts not to fire while I am typing in the search box, so that Space scrolls or types instead of pausing.
21. As a screen reader user, I want the dock announced when it appears and focus never yanked by a navigation, so that collapsing is not disorienting.
22. As a keyboard/AT user, I want focus to land somewhere sensible when I expand or close the dock, so that focus is never lost to the document body.
23. As a viewer deep-linking to the player URL, I want it to work exactly as it does today, so that shared and bookmarked links keep working.
24. As a viewer, I want Back from a deep-linked player to land in the app rather than leaving the site, so that the player is never a dead end.

## Implementation Decisions

- **One persistent `<video>`, zero DOM moves.** An always-mounted outlet renders a Playback Stage while something is playing. The stage owns the video element in its static template; presentation is a class swap on the wrapper plus an `@if` that swaps sibling chrome components. Angular's control flow anchors those blocks at comment nodes, so toggling chrome cannot touch the video node. Re-parenting a live media element with `appendChild` would also be safe (the spec's pause-on-removal step requires reaching a stable state, which an atomic move never does), but a design that moves nothing has no exposure to Angular's teardown ordering at all.
- **The Play Session is untouched.** `createPlaySession` and the media engine need no changes. The stage's lifetime is exactly one playback attempt, so the module's existing `DestroyRef` teardown becomes *more* honest: the session now ends when playback ends, not when a route changes.
- **The full-screen chrome moves into the stage.** `requestFullscreen()` renders only its target's subtree, so the video and the full-screen chrome must share an ancestor. The chrome, the seek bar, the Up Next card and the ending-policy models move from the player page into the stage widget — ADR 0004 already says ending policy is host policy, and the host changed identity from page to widget.
- **The route is the presentation.** Presentation is derived from the router (current navigation, falling back to the last successful one), never stored as a second source of truth. The player route becomes a thin intent component that declares the item and nothing else, with no teardown hook — leaving the route changes the URL, which changes the presentation.
- **A Playback Controller in the play-session feature** holds what is playing and the intent commands (play, expand, dock, close). It lives in the feature layer because both pages and widgets consume it. `play(id)` early-returns on an unchanged id, which is the single guard that makes "play the item that is already docked" expand instead of restart.
- **Close stops synchronously.** The stage registers its session with the controller so `close()` can stop it before clearing the id. Relying on component teardown alone would defer the Stopped report to the next change-detection pass, which loses the race against sign-out clearing the token.
- **Keyboard shortcuts stay a full-screen privilege.** The global key handler lives on the full-screen chrome, which only exists while full screen; the dock gets its own scoped handler. Otherwise Space would hijack the header's search box.
- **Accessibility:** expanding focuses the player container; docking by navigation announces politely and does not steal focus; closing moves focus to the page content region. The dock is a labelled region, its progress indicator is a non-interactive `progressbar` with a clock-formatted `aria-valuetext`, and the expand affordance is a button beside the video, never a button wrapping it.
- **Glossary:** "Playback Stage", "Mini Player" and "Presentation" become project terms.
- **ADR 0004 is not amended** — it predicted this exact host. A new ADR records the stage, the derived presentation, and the file moves that follow from them.

## Testing Decisions

- The load-bearing test is element identity: with a fake media engine and a spy playback API, render the stage, capture the video node, flip presentation, and assert the *same node* is still there, that the engine attached exactly once, that no second Start was reported, and that closing reports Stopped exactly once. If this test passes, the feature's core promise holds.
- The controller is tested at its interface with a real router: play is idempotent for an unchanged id, presentation derives from the URL, expand navigates, close stops and leaves the player URL sensibly.
- The player route is tested for what it now is: activating it starts playback; leaving it does *not* end playback.
- The moved specs (up-next policy, scrub interaction, artwork warmup, next-episode hint) come along unchanged — if they need edits, the move was not a move.
- The dock component gets a presentational spec with a stub session plus an AXE run, following the existing rotator spec's harness.
- Timers stay untouched in stage tests: jsdom's media element stub cannot satisfy the session's stall watchdog.
- Real-server verification (per project rules, the user enters credentials): a direct-play title and a transcoded one, each navigated away from and back to, watching for the absence of a second playback-info request and for a single continuous session in the admin dashboard; an episode auto-advancing while docked; sign-out while docked.

## Out of Scope

- Surviving a hard reload (no playback persistence across page loads). Progress reports keep Continue Watching correct.
- Casting, remote playback targets and SyncPlay.
- Play queues and playlists (episode adjacency remains the only queue-like behavior).
- A draggable or user-positionable dock.
- Native Picture-in-Picture (a natural follow-up on top of this design, not part of it).
- A seekable scrub bar on the dock — the docked progress indicator is read-only in this work.
- Reporting Stopped on tab close (`sendBeacon` on page hide); it must route through the session's end funnel or it double-reports, and page hide also fires for back/forward cache. Deferred deliberately.
- Audio-only playback and any music-library concerns.
- A visual redesign of the full-screen player chrome beyond the controls this feature adds.

## Further Notes

- The player page's current back-navigation has a latent bug: on a deep-linked player URL there is no in-app history, so Back leaves the site. The controller's close path fixes this by falling back to the item page.
- The video element gains `playsinline`, which it lacks today; without it iOS Safari force-fullscreens playback and a dock is impossible on that platform.
- The dock sits below the app header in the stacking order and above nothing else; toasts and dialogs must continue to render above it.
- Changing the hosted item while docked reuses the session module's existing, already-tested rotation: the old session is stopped strictly before the new one starts, on the same element.

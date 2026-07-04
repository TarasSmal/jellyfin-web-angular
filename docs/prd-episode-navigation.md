# PRD: Episode Navigation & Up Next Auto-Advance

## Problem Statement

Watching a TV series is a dead-end experience today. When an episode finishes, the player simply navigates back to wherever the user came from. To watch the next episode, the user must return to the series page, find the right season, scroll the episode list, and click the next episode — for every single episode. There is also no way to jump to the previous or next episode while watching (for example, after realizing you started the wrong one). Binge-watching a series — the primary way people consume TV content — requires constant manual navigation that competing clients (Netflix, Peacock, official jellyfin-web) handle automatically.

## Solution

Make series playback continuous. While an episode is playing, the player chrome offers previous/next episode controls and shows what's coming next. When an episode ends, a Peacock-style "Up Next" countdown card appears with the next episode's thumbnail and title; after ~10 seconds it auto-advances, or the user can play it immediately or cancel. Season boundaries are crossed transparently (the last episode of Season 1 advances to the first of Season 2). After several consecutive hands-off auto-advances, a "Still watching?" confirmation prevents overnight runaway playback. Movies and series finales keep today's behavior (return to where the player was opened). The browser Back button always exits the player rather than stepping back through binged episodes.

## User Stories

1. As a series viewer, I want the next episode to start automatically when the current one ends, so that I can binge a show without touching the mouse.
2. As a series viewer, I want to see an Up Next card with the next episode's thumbnail, code (e.g. S2:E6), and title before auto-advance, so that I know what is about to play.
3. As a series viewer, I want a visible countdown on the Up Next card, so that I know how long until the next episode starts.
4. As a series viewer, I want a "Play now" action on the Up Next card, so that I can skip the credits and the countdown.
5. As a series viewer, I want a "Cancel" action on the Up Next card, so that I can stop auto-advance and leave the player when I'm done watching.
6. As a series viewer, I want a Next Episode button in the player controls, so that I can skip ahead mid-episode without leaving the player.
7. As a series viewer, I want a Previous Episode button in the player controls, so that I can go back one episode if I started the wrong one or missed something.
8. As a series viewer, I want the player to advance across season boundaries, so that finishing a season flows straight into the next one.
9. As a series viewer, I want a "Next: S2:E6 · Title" hint in the player chrome, so that I know what's queued up before the episode ends.
10. As a series viewer, I want a "Still watching?" confirmation after several consecutive auto-advances, so that playback doesn't run all night after I fall asleep.
11. As a series viewer, I want any deliberate interaction (keys, buttons) to reset the still-watching counter, so that I'm not nagged while actively watching.
12. As a series viewer, I want the finale of a series to end playback the way movies do (return to where I came from), so that the player never dead-ends on a broken "next" action.
13. As a movie viewer, I want playback ending behavior to stay exactly as it is today, so that episode features never leak into movie playback.
14. As a keyboard user, I want shortcuts for next and previous episode, so that I can navigate a series without the mouse.
15. As a keyboard user, I want Escape to dismiss the Up Next card, so that I can cancel auto-advance without hunting for a button.
16. As a browser user, I want the Back button to exit the player to where I opened it — not step back through every binged episode — so that leaving after a binge takes one click.
17. As a screen reader user, I want the Up Next card announced when it appears (what's next, how long until it plays, how to cancel), so that auto-advance is not a surprise.
18. As a screen reader user, I want the countdown tick excluded from live announcements, so that my screen reader isn't spammed every second.
19. As a keyboard/AT user, I want focus to land on the card's safe action (Cancel during countdown, Keep Watching on the confirmation), so that a timed action never fires against my intent.
20. As a viewer on a slow connection, I want the next episode's card artwork preloaded near the end of the episode, so that the Up Next card appears instantly and complete.
21. As a viewer, I want the next episode to report playback to the server exactly like a manually started one, so that watched status, resume positions, and the server dashboard stay correct while binging.
22. As a viewer, I want accidental Space presses or clicks during the Up Next card to not restart the finished episode, so that the transition is never glitched by a dead video restart.
23. As a viewer whose series has specials (Season 0), I want previous/next to follow the server's play order, so that navigation matches what the episode list shows.
24. As a viewer, I want previous/next controls to appear only for episodes, so that movie playback chrome stays uncluttered.
25. As a viewer at the first episode of a series, I want the Previous button disabled rather than hidden or broken, so that the layout is stable and the state is clear.

## Implementation Decisions

- **Play Session stays single-item (ADR 0004 intact).** Episode navigation is host policy, not session capability. Navigation happens by changing the hosted item id (router navigation to the player route), which already rotates the session cleanly. The session gains no next/previous/queue concepts.
- **One session amendment:** the session's `ended` signal currently latches true forever; it must reset when the session rotates to a new item, otherwise auto-advance works exactly once per player visit (the page component is reused on param-only navigation). Recorded as an accepted behavior change under ADR 0004.
- **New deep module: Episode Neighbors** (in the play-session feature). Given the currently hosted item as a reactive input, it exposes read-only signals for the previous and next episode (and a loading flag). It is inert for movies and undefined items. Backed by Jellyfin's adjacent-episodes query, which returns the neighbors of an episode across season boundaries in series play order. Neighbors are derived by locating the current episode's position in the returned list, which stays correct even if a server returns a larger window.
- **New request builder in the API layer** for the adjacent-episodes query, following the existing builder conventions (returns nothing while unauthenticated so resources stay idle; all wire format stays in the API layer per ADR 0002).
- **New deep module: Up Next policy** (in the player page's model). A small state machine — idle → countdown → confirm — driven by reactive inputs (hosted item id, session ended, next neighbor, neighbors loading) and two host callbacks (advance, exit). It owns the countdown timer, the once-per-item arming guard (race-proof against stale ended state during transitions), and the consecutive-auto-advance counter that triggers the "Still watching?" confirmation (default: after 3 hands-off advances; countdown default: 10 seconds). Explicit user actions reset the counter.
- **New presentational component: Up Next card.** Dumb component with item/mode/seconds inputs and play/cancel outputs. Two modes: countdown ("Up next … Playing in Ns") and confirm ("Are you still watching?"). Reuses the existing item entity helpers for episode codes and thumbnail URLs.
- **Player page wiring:** hosts the session, the neighbors module, and the policy; renders the card, the previous/next buttons, and the next-episode hint; forwards keyboard shortcuts (Shift+N next, Shift+P previous, Escape cancels the card); guards play/pause gestures while the card is up so the dead session can't be restarted; warms the next episode's thumbnail near the end of playback (metadata only — no stream preloading).
- **History behavior:** episode-to-episode transitions replace the current history entry, so Back always exits the player to where it was opened. The initial entry into the player remains a normal navigation.
- **Cancel semantics:** cancelling the card exits the player (today's ended behavior). Staying on a dead player whose session already reported Stopped was considered and rejected.
- **Accessibility:** the card is a dialog with a one-time polite live announcement on appear (next episode, countdown duration, how to cancel); the ticking number is hidden from assistive tech; initial focus goes to the safe action; WCAG 2.2.1 timing concerns are mitigated by the focused Cancel, Escape, the announcement, and the still-watching guard.
- **Glossary:** "Episode Neighbors" and "Up Next card" become project terms, explicitly distinguished from the existing "Next Up" rail (the server's per-series next-unwatched concept).

## Testing Decisions

- Tests exercise external behavior through module interfaces only — signals observed and commands called — never internal state. This follows the established play-session testing approach: injection-context factories with fake timers, stub dependencies, and a mocked HTTP layer; no browser, no live server.
- **Episode Neighbors** is tested at its interface: inert for movies and undefined items; issues the adjacency request for episodes; resolves both/either/neither neighbor from the returned window (mid-series, first, last, current-missing); refetches when the hosted item changes.
- **Up Next policy** is tested with fake timers and spy callbacks: countdown ticks to exactly one advance; exits when there is no next episode; waits for neighbors to load; cancel kills the timer and exits; explicit play resets the counter; the confirmation state appears after the configured number of hands-off advances and runs no timer; user activity resets the counter; item changes mid-countdown kill the timer; stale ended state across a transition cannot re-arm; teardown clears the timer.
- **Play Session** gains one case: ended resets on rotation and can fire a second time.
- The card component is covered by the policy tests plus manual real-server verification; no component-test infrastructure exists in the repo and this feature does not pioneer it.
- Prior art: the existing play-session and live-resource specs.

## Out of Scope

- Stream preloading / prebuffering of the next episode (only metadata and card artwork are warmed).
- A user setting to disable or configure auto-advance (possible follow-up; the still-watching guard covers the runaway case).
- Skip-intro / skip-credits via media segments.
- Arbitrary play queues or playlists (this is strictly series-adjacency navigation).
- A docked mini-player (ADR 0004 keeps it possible; this feature doesn't build it).
- Changing how the server orders specials/Season 0 — server play order is accepted as-is.
- The end-of-episode behavior for movies and series finales (unchanged by design).

## Further Notes

- Jellyfin's adjacent-episodes query returns a window around the given episode across the whole series, so cross-season advance needs no season bookkeeping on the client.
- During an episode-to-episode transition there is a sub-second window where the old adjacency data is stale; the resource clears while reloading, so at worst the previous/next buttons flicker briefly. Accepted.
- "Previous episode" plays that episode with normal server-side resume semantics (fully watched episodes restart, partials resume) — consistent with starting it from the episode list.
- Real-server verification checklist (per project rules, user enters credentials): mid-season navigation both directions; Back exits to origin; countdown auto-advance including across a season boundary; series finale and movie behavior unchanged; card cancel and play-now; still-watching confirmation after three hands-off advances; screen reader announcement and focus placement; direct-play and transcoded content both advance cleanly.

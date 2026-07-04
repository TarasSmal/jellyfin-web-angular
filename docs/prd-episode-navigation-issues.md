# Implementation issues — PRD: Episode Navigation & Up Next Auto-Advance

Derived from [prd-episode-navigation.md](prd-episode-navigation.md). Four vertical slices; each keeps build, lint, and tests green and is independently verifiable against a real Jellyfin server.

---

## Issue 1

### Title
[Player] Next/Previous episode navigation in the player chrome

### Description
Nothing in the app owns episode adjacency; watching a series means returning to the episode list for every hop. Introduce the Episode Neighbors module in the play-session feature — given the hosted item as a reactive input, it exposes read-only previous/next episode signals (and a loading flag), inert for movies and undefined items. Back it with a new API-layer request builder for Jellyfin's adjacent-episodes query, which returns the neighbors of an episode across season boundaries in series play order (wire format stays in the API layer per ADR 0002). The player page grows previous/next buttons and keyboard shortcuts that navigate to the neighbor; episode-to-episode hops replace the history entry so browser Back always exits the player. The Play Session itself is untouched — changing the hosted item id already rotates it. Add the "Episode Neighbors" term to the glossary.

### User-visible outcome
While an episode plays, Previous/Next Episode buttons appear beside play/pause (episodes only — movies see no change). Clicking them, or pressing Shift+P / Shift+N, jumps straight to the neighboring episode, including across season boundaries. A button is disabled (not hidden) at the series' first/last episode. After hopping through episodes, one press of Back exits the player to where it was opened.

### Scope
- Adjacent-episodes request builder in the API layer, following the existing builder conventions (idle when unauthenticated)
- Episode Neighbors module in the play-session feature, exported via the slice index; neighbors derived by locating the current episode in the returned window
- Interface spec: inert for movies/undefined; request carries the adjacency param; mid-series/first/last/current-missing windows; refetch on item change
- Player page: previous/next buttons with disabled states, `aria-label` and `title` naming the target episode; Shift+N / Shift+P in the keyboard handler; navigation with history-entry replacement
- Glossary: "Episode Neighbors" entry, cross-referenced against the existing "Next Up" rail term

### Reuse notes
- `createPlaySession` untouched; its `item` signal feeds the neighbors module
- Existing `ApiConfig` and builder style in the items API; existing `ItemsResult` type
- `episodeCode` from the item entity for button titles
- Spec harness patterns from the play-session spec (TestBed, `provideHttpClientTesting`, injection-scope factory)

### Dependencies
- None

### Acceptance criteria
- [ ] Mid-season episode: both buttons enabled; Shift+N/P and clicks navigate correctly (verified against a real server)
- [ ] Season boundary: next from a season finale lands on the next season's first episode
- [ ] First/last episode of the series: the corresponding button is disabled; movies show no episode buttons
- [ ] Browser Back after several hops exits the player to the page it was opened from
- [ ] The new episode reports playback normally (visible in the server dashboard)
- [ ] Neighbors spec passes; build, ESLint, steiger, and existing tests stay green

---

## Issue 2

### Title
[Player] Up Next countdown card auto-advances to the next episode

### Description
When an episode ends the player just navigates back — series playback dead-ends. Replace the host's ended-navigates-back policy with an Up Next policy state machine in the player page's model segment: on ended, if a next episode exists, show a countdown card (thumbnail, episode code, title); after 10 seconds it advances, Play Now advances immediately, Cancel (or Escape) exits as today. Movies and series finales keep the exact current behavior. Prerequisite folded in: the session's `ended` signal currently latches true forever, and because the page component is reused on param-only navigation, auto-advance would work exactly once — reset `ended` on session rotation and record the accepted behavior change in ADR 0004. Add the "Up Next card" term to the glossary.

### User-visible outcome
Finishing an episode brings up a Peacock-style card in the corner: "Up next — S2:E6 · Title", counting down from 10. Doing nothing rolls into the next episode (indefinitely, episode after episode); Play Now skips the wait; Cancel or Escape leaves the player. A finished movie or series finale still just returns to where the player was opened. Screen reader users hear the card announced once, with focus landing on Cancel so the timer can't fire against their intent.

### Scope
- `ended` resets when the session rotates to a new item; new play-session spec case; one-line ADR 0004 amendment
- Up Next policy factory (idle → countdown states this issue): once-per-item arming guard race-proof against stale ended state, waits for neighbors to load, snapshot of the advertised episode, timer ownership and teardown; advance/exit as host callbacks
- Up Next card presentational component (countdown mode): thumbnail, episode code/title, Play Now and Cancel, dialog semantics, one-time polite live announcement, ticking number hidden from assistive tech, focus to Cancel, focus returned to the player container on dismiss
- Player page wiring: policy replaces the ended effect; Escape cancels; play/pause gestures guarded while the card is up so the dead session can't restart
- Policy spec with fake timers and spy callbacks; glossary entry for "Up Next card"

### Reuse notes
- Episode Neighbors module from Issue 1 supplies the next episode
- `itemThumbUrl` and `episodeCode` from the item entity for the card
- Navigation-with-replacement helper from Issue 1's page wiring
- Fake-timer spec patterns from the play-session spec; Tailwind tokens (`surface`, `accent`) for the card

### Dependencies
- Issue 1

### Acceptance criteria
- [ ] Episode ends → card appears, counts down from 10, auto-advances; the next episode plays and reports (real server)
- [ ] Auto-advance keeps working across many consecutive episodes in one player visit, including across a season boundary
- [ ] Play Now advances immediately; Cancel and Escape exit to where the player was opened
- [ ] Movie and series-finale endings behave exactly as before (no card)
- [ ] Space or clicking the video while the card is up does not restart the finished episode
- [ ] Card is announced once by VoiceOver; initial focus is on Cancel; the countdown tick is not announced
- [ ] Policy and play-session specs pass; build, ESLint, steiger, and existing tests stay green

---

## Issue 3

### Title
[Player] "Still watching?" guard after consecutive hands-off auto-advances

### Description
Unbounded auto-advance plays all night after the viewer falls asleep. Extend the Up Next policy with a confirm state: after three consecutive auto-advances with no deliberate user interaction, the end of the next episode shows "Are you still watching?" instead of a countdown — no timer runs; Keep Watching continues (and resets the counter), Exit leaves the player. Any deliberate gesture (handled key, button press) resets the counter, so active viewers are never nagged.

### User-visible outcome
Bingeing hands-off, the fourth episode ends with a card that waits for an explicit "Keep watching" instead of counting down. Pressing any player key or button during an episode resets the behavior, so an engaged viewer never sees the prompt.

### Scope
- Confirm state in the Up Next policy: consecutive-auto-advance counter (threshold 3, configurable in the factory), reset on explicit play and on user activity; no timer in confirm state
- `noteUserActivity` wired into every handled key and the chrome buttons
- Card confirm mode: "Are you still watching?" heading, Keep Watching / Exit actions, focus to Keep Watching, same dialog/announcement treatment
- Policy spec extensions: threshold reached → confirm with no timer; explicit play resets; user activity resets; counter survives episode transitions

### Reuse notes
- Up Next policy and card from Issue 2 — extended, no new modules
- Existing keyboard handler and chrome buttons for activity signals

### Dependencies
- Issue 2

### Acceptance criteria
- [ ] Three hands-off auto-advances → the next ending shows the confirmation, and playback waits indefinitely (no countdown)
- [ ] Keep Watching plays the next episode and restores countdown behavior for subsequent endings
- [ ] Any handled key or chrome-button press between endings resets the counter (verified by spec; spot-checked on a real server with a lowered threshold)
- [ ] Exit leaves the player to where it was opened
- [ ] Focus lands on Keep Watching in confirm mode; the card is announced
- [ ] Build, ESLint, steiger, and all tests stay green

---

## Issue 4

### Title
[Player] Next-episode hint in chrome and card artwork preload

### Description
Two small polish behaviors from the PRD. First, surface what's queued before the episode ends: a "Next: S2:E6 · Title" hint in the player controls whenever a next episode exists. Second, warm the next episode's card thumbnail while the current episode plays, so the Up Next card renders instantly and complete on slow connections (metadata already arrives with the adjacency fetch; no stream preloading).

### User-visible outcome
While watching an episode, the controls show what's next (on screens wide enough to fit it). When the Up Next card appears, its artwork is already loaded — no empty box filling in during the countdown.

### Scope
- Hint computed from the next neighbor, rendered in the controls bar, hidden on narrow viewports
- Thumbnail warm-up effect keyed on the next neighbor (an off-screen image fetch; browser cache does the rest)
- No new modules, no new specs beyond a trivial hint-formatting case if one falls out naturally

### Reuse notes
- Episode Neighbors module (Issue 1) and `episodeCode`/`itemThumbUrl` from the item entity
- Existing controls-bar layout and text tokens

### Dependencies
- Issue 1 (hint); Issue 2 (the card that benefits from the preload)

### Acceptance criteria
- [ ] Hint appears for episodes with a next neighbor, names the right episode, and is absent for movies and series finales
- [ ] Hint updates after navigating to another episode
- [ ] With the network throttled, the Up Next card's thumbnail is already rendered when the card appears (verified in devtools)
- [ ] Build, ESLint, steiger, and all tests stay green

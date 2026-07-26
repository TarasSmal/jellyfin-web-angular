# Implementation issues — PRD: Docked Mini-Player

Derived from [prd-mini-player.md](prd-mini-player.md). Four vertical slices; each keeps build, lint, and tests green and is independently verifiable against a real Jellyfin server.

---

## Issue 1

### Title
[Playback] Playback survives navigation in a docked stage

### Description
Playback dies at the route boundary: the player is a route, so navigating away destroys the video element and ends the Play Session. Introduce a Playback Stage — an always-mounted outlet at the app root that renders a stage while something is playing. The stage owns one `<video>` element for the lifetime of one playback attempt and hosts the Play Session, the episode neighbors, the up-next policy and the artwork warmup. Full screen and docked become two presentations of that one element: a class swap on the wrapper plus an `@if` swapping sibling chrome components, so no DOM node is ever moved or re-created. Because `requestFullscreen()` renders only its target's subtree, the full-screen chrome moves out of the player page and into the stage, along with the seek bar, the Up Next card and the ending-policy models — ADR 0004 already makes ending policy the host's, and the host changed identity from page to widget. A Playback Controller in the play-session feature holds what is playing plus the intent commands; presentation is derived from the router rather than stored. The player route shrinks to a thin intent component with no teardown hook. The Play Session module itself is untouched. Record the design in a new ADR and add the glossary terms.

### User-visible outcome
Start a movie and press Back, or click any nav link: the video shrinks into a small player in the bottom-right corner and keeps playing. Clicking it returns to full screen at the live position — no re-buffer, no restart, no lost seconds. The server dashboard shows one continuous session for the whole trip. Deep-linking the player URL still works, and Back from a deep-linked player now lands on the item page instead of leaving the site.

### Scope
- Playback Controller in the play-session feature (item id, play/expand/dock/close, session registration), exported from the slice index; presentation derived from the router's current/last-successful navigation
- Playback outlet and stage widget; the stage hosts the session and the ending-policy modules and renders one `<video>` (now with `playsinline`) under a wrapper whose classes switch between full screen and docked
- Move the full-screen chrome, seek bar and Up Next card into the stage widget's `ui/` segment, and the up-next policy, scrub interaction, artwork warmup and next-episode-hint models into its `model/` segment, with their specs
- Player route reduced to declaring the item; app root renders the outlet
- Fullscreen targets the stage wrapper, and browser fullscreen is exited when the presentation flips to docked
- Minimal dock chrome for this slice: an expand affordance and a close button
- Element-identity spec (same node across a presentation flip, one attach, one Start, exactly one Stopped on close); controller spec; player-route spec
- ADR: one persistent stage, the route as presentation, and the moves that follow; glossary terms "Playback Stage", "Mini Player", "Presentation"

### Reuse notes
- `createPlaySession`, `createEpisodeNeighbors` and the media engine are used unchanged — no edits to the play-session module
- The moved specs must pass unedited; needing edits means the move was not a move
- Fake media engine and spy playback API harness from the existing play-session spec
- Computed class-string binding as used by the rotator, rather than `ngClass`

### Dependencies
- None

### Acceptance criteria
- [ ] Navigating away from the player docks the video and playback continues (verified against a real server)
- [ ] Expanding returns to full screen at the live position, with no second playback-info request in the network panel
- [ ] The server dashboard shows one session across navigate-away-and-back, for both a direct-play and a transcoded title
- [ ] Playing the item that is already docked expands it instead of restarting it; playing a different item swaps cleanly with one Stopped and one Start
- [ ] Closing the dock reports Stopped exactly once; deep-linked player URLs work and Back lands on the item page
- [ ] Element-identity spec passes; moved specs pass unedited; build, ESLint, steiger and existing tests stay green

---

## Issue 2

### Title
[Playback] Real mini-player chrome

### Description
The dock from Issue 1 is functional but bare. Give it the chrome a viewer expects: what is playing, play/pause, progress, expand and close — laid out for a corner card on desktop and a full-width bar on a phone. Keyboard operation is scoped to the dock itself; the global shortcut handler stays on the full-screen chrome, which only exists while full screen, so player keys can never fire while the viewer is typing in the header search box. Focus is specified per transition rather than left to chance: expanding focuses the player container, docking by navigation announces politely without stealing focus, and closing moves focus to the page content region. The full-screen chrome gains an explicit minimize control alongside close, so the meaning of leaving the player is never ambiguous.

### User-visible outcome
The docked player shows the title (series name and episode code for episodes), a play/pause button, a thin progress bar, an expand control and a close button, with controls appearing on hover and focus. On a phone it becomes a full-width bar with a small thumbnail. Everything is reachable by keyboard, screen readers announce the dock when it appears and are told what is playing and how far along it is, and focus always lands somewhere sensible when the player expands or closes.

### Scope
- Dock chrome: labelled region, title and episode subtitle, play/pause with a state-dependent accessible name, read-only progress indicator with clock-formatted value text, expand and close
- Expand affordance as a button beside the video, never a button wrapping it, with the control row above it in stacking order
- Scoped key handling on the dock (toggle play, blur on escape); the global handler stays full-screen-only
- Focus policy per transition (expand, dock-by-navigation, close) and a content region in the app shell to receive focus on close
- Minimize control beside close in the full-screen chrome
- Responsive layout: corner card at desktop widths, full-width bar below the small breakpoint
- Dock component spec with a stub session plus an AXE run

### Reuse notes
- Item entity helpers for the episode subtitle; the shared clock formatter for value text
- AXE harness from the existing rotator spec
- Tailwind tokens only; motion-safe transitions

### Dependencies
- Issue 1

### Acceptance criteria
- [ ] Title, play/pause, progress, expand and close all work from the dock (verified against a real server)
- [ ] Play/pause announces its current state; the progress indicator exposes position and duration to assistive tech without adding a tab stop
- [ ] Typing in the header search box never triggers player shortcuts
- [ ] Focus lands on the player container when expanding and on the content region when closing; docking does not move focus
- [ ] The dock is usable as a full-width bar at phone widths
- [ ] AXE spec passes; build, lint and tests stay green

---

## Issue 3

### Title
[Playback] Auto-advance and the still-watching guard while docked

### Description
The ending policy currently assumes a full-screen host. With the stage owning a single up-next policy instance that a presentation change never re-creates, auto-advance and the consecutive-advance counter already survive expanding and collapsing — this issue proves that and gives the docked presentation a compact way to render the same policy state, so a countdown that begins while docked is visible and cancellable without expanding. A movie ending while docked closes the dock, matching today's exit-as-before behavior.

### User-visible outcome
An episode that finishes while you are browsing rolls into the next one, with a compact countdown strip on the dock naming the next episode and offering Play now and Cancel. Expanding mid-countdown shows the same countdown in the full-screen card, at the same number of seconds. The "Are you still watching?" guard still appears after several hands-off advances, whether or not you have been expanding and collapsing. A movie that finishes while docked closes the dock.

### Scope
- Compact countdown and confirmation rendering on the dock, driven by the existing policy state (no fork of the policy)
- One policy instance in the stage, wired to both presentations; advance rotates the hosted item, exit closes playback
- Politely announced countdown on the dock, with the ticking number hidden from assistive tech as in the full-screen card
- Stage-level spec: the countdown survives a presentation flip, and advancing rotates the session without creating a second video element

### Reuse notes
- The existing up-next policy, unchanged if at all possible — the docked view renders its published state
- Announcement and hidden-tick patterns from the existing Up Next card

### Dependencies
- Issue 1 (Issue 2 recommended first, for the chrome to attach to)

### Acceptance criteria
- [ ] An episode ending while docked shows the countdown and advances (verified against a real server)
- [ ] Expanding mid-countdown shows the same remaining seconds; collapsing again does not restart it
- [ ] Play now and Cancel work from the dock; a finished movie closes the dock
- [ ] The still-watching confirmation still appears after the configured number of hands-off advances across presentation changes
- [ ] Build, lint and tests stay green

---

## Issue 4

### Title
[Playback] Sign-out, signed-out screens, and content that the dock would cover

### Description
A persistent dock introduces states the app has never had: playing while signing out, playing while a guard redirects to the login screen, and a floating panel over scrollable page content. Stop playback before the token is cleared so the final report is authenticated; render nothing while signed out and end playback on the transition; and give page content enough bottom room that the dock never hides the end of a list.

### User-visible outcome
Signing out while something is playing stops it cleanly and leaves no session running on the server. The login and connect screens never show a docked player. Scrolling to the bottom of a library or an episode list is not blocked by the dock.

### Scope
- Sign-out stops playback before authentication state is cleared
- The outlet renders nothing without a signed-in user and closes playback when the user becomes null
- Bottom spacing for shell content while a dock is present
- Specs: Stopped is reported exactly once across close-then-teardown; sign-out ordering

### Reuse notes
- The session store's user signal for the signed-in check
- The controller's synchronous close from Issue 1

### Dependencies
- Issue 1

### Acceptance criteria
- [ ] Signing out while docked stops playback and the server shows no lingering session (verified against a real server)
- [ ] No dock appears on the login or connect screens, including after a token expiry redirect
- [ ] The bottom of a long library grid and a long episode list remain reachable and readable with a dock present
- [ ] Build, lint and tests stay green

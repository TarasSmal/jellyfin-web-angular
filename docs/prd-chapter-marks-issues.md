# Implementation issues — PRD: Chapter marks on the player seek bar

Derived from [prd-chapter-marks.md](prd-chapter-marks.md). Three vertical slices; each keeps build, lint, and tests green and is independently verifiable against a real Jellyfin server.

---

## Issue 1

### Title
[Player] Custom seek bar with commit-on-release scrubbing

### Description
The seek bar is a native range input that fires a seek on every drag tick — on a transcoded stream each one can restart the server pipeline — and it cannot host chapter marks or a tooltip. Replace it with a custom seek bar component owned by the player page: a thin DOM shell over a pure scrub-interaction model (player page model segment) that decides what position to display (drag position while dragging, live position otherwise), what the tooltip shows and where, what single seek to commit on release, and the accessible value text. The component carries full slider accessibility — slider role, value min/max/now, arrow-key/Home/End seeking committed per press, visible focus — since we give up the native control's free semantics. No chapters in this slice: the tooltip shows the timestamp only, and the accessible value text is the timestamp only.

### User-visible outcome
Scrubbing feels like a streaming player: while dragging, the thumb and a timestamp tooltip follow the pointer (also under a finger on touch) without the video stuttering through positions, and the video seeks exactly once, where released. Outside a drag the bar tracks live playback as before. The bar is keyboard-seekable (arrows, Home, End) with a visible focus state, and screen readers announce it as a slider with the current time.

### Scope
- Scrub-interaction model in the player page's model segment: pure state machine over pointer/keyboard intents; display-position resolution (drag wins over live), tooltip content/position, exactly one committed seek per release at the release position, keyboard step and clamping, accessible value-text composition
- Seek bar component in the player page's UI segment: track/thumb/tooltip rendering from Tailwind tokens, pointer capture, track-geometry-to-fraction math, slider ARIA bindings, chapters input accepted but unused this issue
- Player page: native range input replaced by the component, wired to the session's position/duration/seek
- Scrub-interaction spec (behavior-level, fake positions — no DOM)

### Reuse notes
- Play Session untouched: existing `position`, `duration`, `seek` signals/commands are the entire contract
- Existing controls-overlay visibility behavior unchanged; the component slots into the same markup position
- Spec style from the existing player page model specs (up-next policy)

### Dependencies
- None

### Acceptance criteria
- [ ] Dragging shows thumb + timestamp tooltip following the pointer; the video seeks once, on release, at the release position (verify on a Transcode stream against a real server)
- [ ] Touch drag shows the same tooltip and commits on finger lift
- [ ] Outside a drag the bar tracks live playback; after release it resumes tracking without jumping back
- [ ] Arrow keys, Home, and End seek from the keyboard, each press committing immediately; focus state clearly visible
- [ ] VoiceOver announces a slider with current position; AXE checks pass on the player with controls visible
- [ ] Scrub-interaction spec passes; build, ESLint, steiger, and existing tests stay green

---

## Issue 2

### Title
[Player] Chapter marks on the seek bar track

### Description
Jellyfin knows the chapter structure of most media but the client never asks for it. Add the chapter wire shape (start ticks, optional name, optional image tag) to the API layer's types and request the chapters field in the single-item request — wire format stays in the API layer per ADR 0002; the item detail page shares this request and simply receives the extra field. Add a chapter timeline module to the play-session feature: pure shaping of the item's chapter DTOs into `{ name, startSeconds }` (tick conversion, "Chapter N" fallback naming, ordering) plus a containing-chapter lookup — a chapter contains every moment from its start until the next chapter's start. The session exposes a derived `chapters()` signal so pages never see wire-shaped chapter data (ADR 0004 contract). The seek bar renders a tick mark at each chapter start; a chapter starting at zero gets no tick (the track edge marks nothing) but still participates in lookup.

### User-visible outcome
Items with embedded chapters show small tick marks along the seek bar at chapter boundaries, visible on both the played and unplayed portions of the track at WCAG-viable contrast. Items without chapters show the identical bar with no marks. Marks are purely informative in this slice — seeking behavior is unchanged and nothing snaps to them.

### Scope
- API layer: chapter DTO added to the types; chapters field added to the single-item request builder
- Chapter timeline module in the play-session feature's model segment, exported via the slice index: DTO shaping (ticks → seconds, fallback naming, ordering) and containing-chapter lookup
- Play Session: derived `chapters()` signal over the hosted item
- Seek bar: chapters input rendered as marks positioned by start-fraction; no mark at position zero; marks are non-interactive (no pointer targets, hidden from assistive tech)
- Chapter timeline spec: tick conversion, fallback naming, lookup at boundaries (exactly on a start, before first, after last), empty/absent chapter lists

### Reuse notes
- Existing single-item request builder and its `fields` convention; existing `BaseItemDto` in the API types
- Existing ticks-to-seconds conversion used by the play-session
- Seek bar component from Issue 1 (chapters input already in its interface)
- Spec style from the play-session feature's existing model specs (episode neighbors)

### Dependencies
- Issue 1

### Acceptance criteria
- [ ] A movie/episode with embedded chapters shows tick marks at chapter starts (verified against a real server); a chapterless item shows none
- [ ] No mark at the very start of the track even when a chapter begins at zero
- [ ] Marks stay correct when playback rotates to a different item (next episode, Up Next auto-advance) — never stale from the previous item
- [ ] Item detail page still renders normally with the fatter item payload
- [ ] Marks are not focusable and not announced by VoiceOver; AXE stays green
- [ ] Chapter timeline spec passes; build, ESLint, steiger, and existing tests stay green

---

## Issue 3

### Title
[Player] Tooltip and screen-reader value announce the containing chapter

### Description
Marks alone say *where* chapters start but not *what* they are. Thread the chapter timeline's containing-chapter lookup into the scrub-interaction model so the tooltip reads "time · chapter name" anywhere on the track — the chapter containing the hovered or dragged point, not just near marks — and the slider's accessible value text becomes "time, chapter name", making chapter structure audible to screen-reader users who never see the ticks. Unnamed chapters read "Chapter N" (from the timeline module's fallback). Chapterless items keep the time-only tooltip and value text from Issue 1. Hover over the track (no drag) also shows the tooltip, completing the PRD's hover-or-scrub behavior. Seeking still never snaps to marks.

### User-visible outcome
Hovering anywhere over the seek bar — or dragging it — shows "23:14 · The Heist" for that point on the timeline; unnamed chapters show "Chapter 3". Screen readers hear the chapter name as part of the slider's value while seeking with the keyboard. On chapterless items the tooltip and announcement remain time-only, exactly as in Issue 1.

### Scope
- Scrub-interaction model: hover intent (tooltip without drag) alongside drag; tooltip content and accessible value text composed via the containing-chapter lookup; chapterless fallback to time-only
- Seek bar component: hover tracking over the track, tooltip on hover as well as drag, `aria-valuetext` binding
- Scrub-interaction spec extended: chapter name at boundaries (exactly on a start, mid-chapter, before first/after last chapter), unnamed fallback, chapterless time-only, hover vs drag tooltip states, still exactly one seek per release with no snapping

### Reuse notes
- Containing-chapter lookup from Issue 2's chapter timeline module — the single lookup shared by tooltip and accessible text
- Scrub-interaction model and seek bar component from Issue 1
- Session `chapters()` signal from Issue 2

### Dependencies
- Issue 1, Issue 2

### Acceptance criteria
- [ ] Hovering the track (no drag) shows "time · chapter name" for the containing chapter; the same tooltip shows while dragging (real server, chaptered item)
- [ ] Exactly on a chapter start the tooltip names that chapter; just before it, the previous one
- [ ] Unnamed chapters display "Chapter N"; chapterless items show a time-only tooltip
- [ ] VoiceOver reads time plus chapter name while keyboard-seeking; time-only on chapterless items; AXE stays green
- [ ] Release still seeks exactly where dropped near a mark (no snapping)
- [ ] Extended scrub-interaction spec passes; build, ESLint, steiger, and existing tests stay green

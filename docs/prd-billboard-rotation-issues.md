# Issues: Hero Billboard rotation via a generic Rotator primitive

Source PRD: `docs/prd-billboard-rotation.md`. Five vertical slices; each delivers a complete user-visible behavior and keeps accessibility green at every merge point (auto-rotation and its WCAG-mandated pause control ship together in issue 3).

---

## Issue 1

### Title
[Billboard] Home billboard showcases up to five featured titles with arrow navigation

### Description
The tracer bullet: introduce the generic Rotator primitive (headless rotation model + thin component + slide structural directive), the Featured Items selection function, and rewire the hero billboard from one item to many. No auto-advance yet — navigation is manual via prev/next arrows. Establishes the slide contract (structural directive → lazy templates), the active+next-only DOM policy, the crossfade, wrap-around, single-item degradation, and the APG carousel ARIA structure.

### User-visible outcome
The home billboard presents up to five featured titles (interleaved latest movies/shows, backdrop required, logo preferred, deduped). Prev/next arrows crossfade between them, wrapping at the ends. With a single featured title the billboard looks exactly like today: no arrows.

### Scope
- Headless rotation model: active index, upcoming (pre-render) index, next/previous/go-to commands, wrap-around, single-slide degradation (no upcoming slide, controls hidden signal)
- Rotator component + slide structural directive in the shared UI layer; instantiates only active + upcoming slide, upcoming pre-rendered hidden; ~500ms crossfade
- ARIA: carousel role description on the container, each slide a labelled "N of M" group; arrows keyboard-operable with accessible names
- Featured Items selection function in the home page model segment: interleave, backdrop required, logo preferred, dedupe by id, cap at 5, empty-input safe
- Hero billboard widget input changes from single item to array; existing layout (backdrop, logo/text title, facts row, Details CTA) becomes the per-slide content; only slide 1's backdrop loads at high priority
- Home page: replace the single-hero computed with the featured selection; loading skeleton unchanged

### Reuse notes
- BlurImg (BlurHash placeholder, srcset) renders each slide's backdrop, unchanged
- Item image helpers from the item entity (backdrop URL/srcset/hash, logo URL) and the runtime formatter
- Existing home-page httpResources for latest movies/shows — no new API calls
- Tailwind tokens and existing scrim gradients from the current hero template

### Dependencies
- None

### Acceptance criteria
- [ ] Billboard cycles through up to 5 featured titles via arrows, crossfading, wrapping last→first and first→last
- [ ] Featured set alternates movies/shows, contains only backdrop-bearing items, prefers logos, has no duplicates
- [ ] DOM contains only the active and upcoming slides at any moment (verified in component spec); only the first backdrop is fetched with high priority
- [ ] With one featured title: static hero, no arrows or other controls
- [ ] Rotation model spec, featured selection spec, and rotator component DOM/ARIA spec pass (fake timers not yet needed)
- [ ] AXE clean; arrows reachable and operable by keyboard
- [ ] `npm run build`, `npm run lint`, `npm test` green; verified in browser against the real Jellyfin server

---

## Issue 2

### Title
[Billboard] Position dots show and jump between featured titles

### Description
Add the dot indicator row to the Rotator: one dot per slide, active dot highlighted, each dot a button that jumps directly to its slide. Peacock-style placement (bottom-right of the billboard).

### User-visible outcome
The viewer sees how many featured titles exist and which is showing, and can click/keyboard-activate any dot to jump straight to that slide.

### Reuse notes
- Rotation model's go-to command from issue 1 — dots are pure UI over it

### Scope
- Dot row rendered by the Rotator (generic — count derives from slides, not from hero data)
- Each dot: accessible name ("Go to slide N of M"), current-slide state exposed to assistive tech
- Hidden entirely in single-slide mode

### Dependencies
- Issue 1

### Acceptance criteria
- [ ] One dot per featured title; active dot visually distinct and exposed as current to assistive tech
- [ ] Activating a dot crossfades to that slide; works with keyboard alone
- [ ] Dots absent with a single featured title
- [ ] Component spec covers dot count, jump behavior, and ARIA; AXE clean
- [ ] Build, lint, tests green; verified in browser against the real Jellyfin server

---

## Issue 3

### Title
[Billboard] Auto-rotation with pause control and motion safeguards

### Description
Add the timer to the rotation model and surface the full WCAG 2.2.2 policy in one slice: 7-second auto-advance, hover and focus-within pausing, a visible pause/play toggle, permanent stop after manual navigation, and no auto-rotation under reduced motion. These ship together — auto-advance must never merge without its pause mechanism.

### User-visible outcome
The billboard advances by itself every ~7 seconds. Hovering or tabbing into it pauses rotation; a visible pause/play button stops and resumes it; using arrows or dots stops auto-rotation for good; viewers with reduced-motion preferences never see auto-rotation at all.

### Scope
- Rotation model gains the interval timer (injectable clock for tests), pause/resume, hover/focus pause inputs, stop-after-manual-navigation, reduced-motion suppression, single-slide no-op
- Pause/play toggle button in the Rotator with accessible name and pressed state
- Slide-change announcements are polite and only occur while rotation is paused
- Crossfade remains under reduced motion (opacity-only); only auto-advance is suppressed

### Reuse notes
- Timer logic lives entirely in the issue-1 rotation model; the component only adds the toggle button and hover/focus listeners

### Dependencies
- Issue 1 (issue 2 not required)

### Acceptance criteria
- [ ] Slides auto-advance every ~7s and wrap around
- [ ] Hover and focus-within pause; leaving resumes (unless stopped)
- [ ] Pause/play toggle visible, keyboard-operable, state exposed to assistive tech
- [ ] Any manual navigation (arrow, dot, swipe once it exists) permanently stops auto-rotation for the visit
- [ ] With `prefers-reduced-motion`: no auto-rotation ever starts; manual navigation still works
- [ ] Single featured title: no timer runs, no pause control shown
- [ ] Fake-timer model specs cover all of the above; AXE clean
- [ ] Build, lint, tests green; verified in browser against the real Jellyfin server

---

## Issue 4

### Title
[Billboard] Active dot fills over the rotation interval

### Description
Peacock-style polish: the active dot animates its fill across the 7-second interval, signalling when the next slide arrives. The animation pauses with rotation, resets on slide change, and never runs when rotation is stopped, paused, or suppressed by reduced motion.

### User-visible outcome
The viewer can anticipate the next slide by watching the active dot fill up; the fill freezes while hovering/paused and disappears once rotation stops.

### Scope
- CSS-driven fill animation on the active dot, duration bound to the rotation interval
- Play-state synced to the model's paused/stopped signals; no fill under reduced motion or in single-slide mode

### Reuse notes
- Dots from issue 2; paused/stopped signals from issue 3 — no new model state

### Dependencies
- Issues 2 and 3

### Acceptance criteria
- [ ] Active dot fills over the interval and the slide changes as it completes
- [ ] Fill pauses on hover/focus/pause-toggle, resumes correctly, resets on slide change
- [ ] No fill animation when rotation is stopped, under reduced motion, or with a single slide
- [ ] AXE clean; build, lint, tests green; verified in browser against the real Jellyfin server

---

## Issue 5

### Title
[Billboard] Swipe gestures change featured titles on touch devices

### Description
Synthetic swipe detection on the Rotator (pointer events with a horizontal threshold — there is no draggable track): swipe left advances, swipe right goes back. A swipe counts as manual navigation and therefore permanently stops auto-rotation.

### User-visible outcome
On phones and tablets the viewer flips through featured titles by swiping the billboard, and auto-rotation stops once they do.

### Scope
- Pointer-event gesture detection (threshold + axis lock so vertical page scrolling is never hijacked)
- Swipe triggers the existing next/previous commands and the stop-after-manual-navigation rule

### Reuse notes
- Next/previous commands and stop rule from issues 1 and 3 — the gesture layer adds no new rotation state

### Dependencies
- Issue 1 (stop-on-swipe rule activates fully once issue 3 lands)

### Acceptance criteria
- [ ] Horizontal swipe changes slides in the expected direction; vertical scrolling over the billboard is unaffected
- [ ] Swipe permanently stops auto-rotation (once issue 3 is merged)
- [ ] Arrows, dots, and pause control still work on touch
- [ ] Build, lint, tests green; verified in a touch-emulating browser and on the real Jellyfin server

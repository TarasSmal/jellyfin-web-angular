# PRD: Hero Billboard rotation via a generic Rotator primitive

## Problem Statement

The home page's Hero Billboard showcases exactly one item — the newest movie or show that happens to have a backdrop. Everything else the library gained recently is invisible unless the user scrolls the rails. The hero occupies most of the viewport on load, yet advertises a single title, and there is no way to browse alternatives from it. Peacock (the design reference for this client) rotates its billboard through a handful of featured titles; our static hero looks lifeless by comparison.

## Solution

The Hero Billboard becomes a rotating showcase of up to five Featured Items, cycling automatically every ~7 seconds with a crossfade. The viewer can take control at any time: previous/next arrows, clickable position dots (the active dot animates its fill over the rotation interval), a visible pause/play toggle, and touch swipe gestures. Manual navigation stops auto-rotation permanently for that visit; the pause control satisfies WCAG 2.2.2. Users with reduced-motion preferences never see auto-rotation. With only one featured item available, the billboard degrades to today's static hero with no controls.

The rotation mechanics are delivered by a new generic, reusable Rotator UI primitive — deliberately named to avoid colliding with the existing Rail concept (many cards, scrolls) — of which the hero billboard is the first consumer.

## User Stories

1. As a viewer, I want the home page billboard to rotate through several featured titles, so that I discover more of my library without scrolling.
2. As a viewer, I want the billboard to advance on its own every few seconds, so that discovery happens ambiently while I decide what to watch.
3. As a viewer, I want each slide to show the title's backdrop, logo, year, runtime, rating, and synopsis, so that every featured title gets the same rich presentation the current hero has.
4. As a viewer, I want a Details call-to-action on every slide, so that I can jump straight to the featured title's page.
5. As a viewer, I want previous/next arrow buttons, so that I can flip through featured titles at my own pace.
6. As a viewer, I want position dots showing how many featured titles exist and which one I'm on, so that I know where I am in the set.
7. As a viewer, I want to click a dot to jump directly to that slide, so that I can return to a title I glimpsed earlier.
8. As a viewer, I want the active dot to fill up over the rotation interval, so that I can anticipate when the next slide arrives.
9. As a viewer, I want auto-rotation to stop for good once I navigate manually, so that I'm not yanked away from a slide I chose to read.
10. As a viewer, I want rotation to pause while my pointer hovers the billboard, so that I can read the synopsis without racing the timer.
11. As a viewer, I want a visible pause/play toggle, so that I can stop the motion entirely without hovering.
12. As a keyboard user, I want rotation to pause while focus is inside the billboard, so that the slide doesn't change under my focus.
13. As a keyboard user, I want to reach and operate the arrows, dots, and pause toggle with the keyboard alone, so that the billboard is fully usable without a mouse.
14. As a motion-sensitive user, I want auto-rotation suppressed when my system prefers reduced motion, so that the home page doesn't animate against my wishes.
15. As a screen-reader user, I want the billboard exposed as a carousel with each slide labelled "N of M", so that I understand the structure and my position.
16. As a screen-reader user, I want slide changes announced politely only when I've paused rotation, so that automatic cycling doesn't spam my reader.
17. As a touch user, I want to swipe left/right on the billboard to change slides, so that navigation feels native on my device.
18. As a viewer on a slow connection, I want the upcoming slide's backdrop preloaded before the crossfade, so that transitions land on real artwork instead of a blurred placeholder.
19. As a viewer on a slow connection, I want only the visible and upcoming slides' images to download, so that five full-screen backdrops don't compete with the rails below.
20. As a viewer, I want the last slide to advance to the first (and previous on the first to reach the last), so that browsing feels continuous.
21. As a viewer with only one featured title available, I want a plain static hero with no arrows, dots, or pause button, so that controls never appear that do nothing.
22. As a viewer, I want featured titles to alternate between movies and shows, so that the billboard reflects both sides of my library.
23. As a viewer, I want featured titles to always have backdrop art and preferably a title logo, so that every slide looks premium rather than falling back to plain text.
24. As a viewer, I want the same title to never appear twice in the rotation, so that the set feels curated.
25. As a viewer, I want the home page to load no slower than before, so that the richer billboard costs nothing up front (no new API calls; only the first backdrop is fetched at high priority).
26. As a developer, I want rotation delivered by a generic Rotator primitive, so that a future rotating surface reuses it instead of rebuilding timers and controls.

## Implementation Decisions

- **Rotator primitive** — a new generic UI component in the shared layer, named Rotator (not "carousel", which would collide with the Rail concept in the glossary; CONTEXT.md has been updated with Rotator, Featured Items, and a revised Hero Billboard definition).
- **Slide contract** — consumers declare slides with a structural directive (element-like authoring that is sugar for a template). Chosen over projected slide components because projected content instantiates eagerly and detached images still download; templates are the only way to honor lazy slide creation.
- **Slide lifecycle** — only the active slide and the upcoming slide are instantiated; the upcoming slide pre-renders hidden so its backdrop is cached before the transition. All other slides are destroyed. Only the first slide's backdrop is fetched at high priority.
- **Transition** — ~500ms crossfade of absolutely-stacked slides (what Peacock does), with wrap-around looping. No sliding track.
- **Auto-advance policy** — 7-second interval; pauses on hover and on focus-within; visible pause/play toggle (WCAG 2.2.2 Pause, Stop, Hide); permanently stops after any manual navigation; never starts under prefers-reduced-motion (the crossfade itself, being opacity-only, remains).
- **Controls** — prev/next arrows, clickable position dots with the active dot animating its fill across the interval, pause/play toggle, and touch swipe gestures (synthetic pointer-event detection; there is no draggable track).
- **Headless rotation model** — the state machine (active index, pre-render index, wrap-around, timer, pause states, stop-on-manual-navigation, reduced-motion suppression, single-slide degradation) is a DOM-free signal-based unit exposing commands (next, previous, go-to, toggle pause) and read signals. The Rotator component is a thin DOM shell over it.
- **Accessibility** — APG carousel pattern: carousel role description on the container, each slide a group labelled "N of M", polite live announcements only while rotation is paused.
- **Hero Billboard widget** — its input changes from a single item to an array; it composes the Rotator internally and renders the existing hero layout (backdrop with BlurHash, logo with text fallback, facts row, Details CTA) once per slide. Pages stay dumb.
- **Featured Items selection** — a pure function in the home page's model segment: interleave latest movies and latest shows (already fetched — no new API calls), require a backdrop, prefer items with a title logo, dedupe by id, cap at five. Falls back to backdrop-only items when logos are scarce.
- **Single-item degradation** — with one featured item the billboard renders statically: no rotation, no arrows, dots, or pause control.

## Testing Decisions

Good tests exercise external behavior through the module's public interface — commands in, observable signal/DOM state out — never internal fields or timer internals directly (fake timers advance time; assertions read public state).

- **Rotation model** (test): advances every interval, wraps around, hover/focus pauses and resumes, pause toggle works, manual navigation stops auto-rotation permanently, reduced motion never starts the timer, single slide never rotates, pre-render index always points to the upcoming slide. Prior art: the play-session and up-next-policy model specs.
- **Featured Items selection** (test): interleaves movies/shows, drops items without backdrops, prefers logos, dedupes, caps at five, handles empty inputs. Prior art: up-next-policy and item-labels specs.
- **Rotator component** (test): only active + upcoming slides exist in the DOM, controls carry correct ARIA, dot click jumps to the slide, single-slide mode hides all controls. Prior art: blur-img and item-card component specs.
- **Hero Billboard widget** — no unit tests; it is mostly template and is covered by the mandatory browser verification against the real Jellyfin server before commit.

## Out of Scope

- A dedicated server-side "featured"/curated query — the set derives from already-fetched latest items.
- Draggable/inertial track physics — swipe is a discrete gesture that triggers previous/next.
- Rotating heroes on item detail pages or any surface other than the home page.
- Video or trailer playback inside billboard slides.
- Per-user or admin curation of which items are featured.
- Persisting pause/stop state across visits.

## Further Notes

- Glossary terms Rotator, Featured Items, and the updated Hero Billboard were added to CONTEXT.md during the design session.
- No ADR was written: the primitive-vs-widget-internal choice is cheap to reverse, and the rationale lives in the glossary and this PRD.
- Peacock's own billboard is the visual reference: crossfade, bottom-left content block, bottom-right dots.

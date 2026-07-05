# PRD: Chapter marks on the player seek bar

## Problem Statement

When watching a movie or episode, the seek bar is a featureless line. The viewer has no idea where scenes begin or end, so finding "the scene after the recap" or "where I actually stopped paying attention" means blind scrubbing back and forth. Jellyfin already knows the chapter structure of most media (embedded chapter metadata: names and start times), and the official clients surface it — this client throws that information away.

## Solution

Show chapter marks on the player's seek bar. Each mark is a small tick at a chapter's start; hovering or scrubbing anywhere on the track shows a tooltip with the timestamp and the name of the chapter containing that point (unnamed chapters read "Chapter N"). Marks are guidance, not targets: seeking never snaps to them.

To render marks and tooltips, the native range input is replaced with a custom seek bar component with full slider accessibility. Scrubbing becomes commit-on-release: while dragging, the thumb and tooltip follow the pointer locally, and the actual seek fires once when released — kinder to the transcoder than today's seek-per-drag-tick behavior, and the tooltip doubles as the scrub preview.

Items without chapters get the identical seek bar with zero marks and a time-only tooltip.

## User Stories

1. As a viewer, I want to see tick marks on the seek bar at chapter boundaries, so that I can tell at a glance how the item is structured.
2. As a viewer, I want to hover over any point on the track and see the timestamp plus the chapter name for that point, so that I can aim a seek at the scene I want.
3. As a viewer, I want the tooltip to work across the whole track (not only near marks), so that the seek bar is informative everywhere.
4. As a viewer scrubbing with the mouse, I want the thumb and tooltip to follow my pointer while I drag and the video to seek only when I release, so that the picture doesn't stutter through positions I never meant to watch.
5. As a viewer on a transcoded stream, I want dragging the seek bar to trigger a single seek on release, so that the server doesn't restart the transcode pipeline for every pixel of drag.
6. As a viewer, I want to release the drag exactly where I dropped it, with no snapping to chapter marks, so that fine seeking near a chapter boundary isn't fought by magnetism.
7. As a viewer watching an item with unnamed chapters, I want them labeled "Chapter 1", "Chapter 2", …, so that the tooltip is still meaningful.
8. As a viewer watching an item with no chapter metadata, I want the same seek bar with no marks and a time-only tooltip, so that the player feels consistent across my library.
9. As a touch user, I want the tooltip to appear while I drag, so that I get the same chapter guidance without a hover state.
10. As a keyboard user, I want to focus the seek bar and seek with arrow keys, Home, and End, so that I can navigate playback without a pointer.
11. As a keyboard user, I want each key press to commit a seek immediately, so that keyboard seeking feels direct rather than requiring a separate confirm.
12. As a screen-reader user, I want the seek bar announced as a slider with current value, so that I know what control I'm on and where playback is.
13. As a screen-reader user, I want the announced value to include the current chapter name alongside the timestamp, so that chapter structure is available to me even though the marks are visual.
14. As a viewer, I want the seek bar to keep reflecting live playback position whenever I'm not dragging, so that the control always tells the truth.
15. As a viewer, I want chapter marks to appear or disappear correctly when playback rotates to a different item (next episode, Up Next auto-advance), so that marks never show stale data from the previous item.
16. As a viewer, I want the seek bar to meet contrast and focus-visibility requirements, so that the player remains usable in bright rooms and with low vision.

## Implementation Decisions

- This feature covers embedded **chapters** only. Jellyfin **media segments** (server-side intro/credits detection, "Skip Intro") are a different API and explicitly not part of this work.
- The Jellyfin item request gains the chapters field so chapter metadata arrives with the item. The wire DTO for a chapter (start position in ticks, optional name, optional image tag) lives in the shared API layer only, per the existing hand-rolled-client decision. The item detail page shares this request and will also receive chapters; this is accepted (payload is trivial and potentially useful there later).
- The Play Session exposes a derived chapters signal — name plus start in seconds, ticks already converted — so pages never touch wire-shaped chapter data. This keeps the existing rule that pages interact with playback only through session signals and commands.
- The native range input in the player controls is replaced by a custom seek bar component owned by the player page. It is deliberately dumb: inputs are position, duration, and chapters; its single output is a committed seek.
- Two deep, DOM-free modules carry the logic, with the component as a thin binding shell:
  - **Chapter timeline** (play-session model): shapes the item's chapter DTOs into the session's chapter list (tick conversion, fallback naming, ordering/clamping) and answers "which chapter contains time T" — the one lookup shared by the tooltip and the accessibility text. A chapter contains every moment from its start until the next chapter's start.
  - **Scrub interaction** (player page model): a pure state machine over pointer/keyboard intents that answers what position to display (drag position while dragging, live position otherwise), what the tooltip shows and where, what seek to commit on release, and the accessible value text. All commit-on-release subtlety lives here.
- Accessibility contract for the custom slider: slider role, value min/max/now, arrow-key/Home/End seeking, visible focus state, and a human-readable value text of the form "timestamp, chapter name".
- While dragging, the displayed position is the drag position and it wins over the session's live position; on release the seek is committed and live position resumes as the source of truth.
- A chapter mark at position zero is not rendered (a tick at the track's left edge marks nothing distinguishable), though the first chapter still participates in containing-chapter lookup.

## Testing Decisions

- Good tests here exercise external behavior of the pure modules — inputs in, decisions out — never internal state or rendering details.
- **Chapter timeline** gets unit tests: tick conversion, fallback naming for unnamed chapters, containing-chapter lookup at boundaries (exactly on a start, before the first chapter, after the last), empty/absent chapter lists.
- **Scrub interaction** gets unit tests: display position during vs. outside a drag, tooltip content and position, exactly one committed seek per release at the release position, no snapping near marks, keyboard step/clamp behavior, value-text composition.
- Prior art: the existing behavior-level Vitest model specs in the player page and play-session models (up-next policy, play-session lifecycle).
- The seek bar component itself gets no DOM unit test; keyboard behavior, AXE checks, and real playback (including a transcoded stream) are verified in the browser against the real Jellyfin server before commit, per project practice.

## Out of Scope

- Chapter thumbnails (Jellyfin serves per-chapter images) — possible follow-up.
- A chapter list menu and previous/next chapter controls or shortcuts.
- Snapping or any magnetism toward chapter marks.
- Media segments / skip-intro functionality.
- Buffered-range display or other seek bar enhancements beyond chapter marks and the tooltip.

## Further Notes

- Replacing the native range input trades free native slider semantics for rendering control. The decision was judged cheap to reverse (swap the component back), so no ADR was written; the accessibility contract above is the guardrail.
- "Chapter" and "Chapter Mark" are defined in the project glossary.
- The riskiest step is the custom slider's keyboard/AXE verification in a real browser — expect any rework to surface there rather than in the pure modules.

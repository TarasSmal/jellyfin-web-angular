# PRD — Play Session module: extract playback lifecycle from the player page


## Problem Statement

When I watch a movie or an episode in the web client, playback mostly works, but the experience is fragile at the edges: if a progress-report request to the server fails, the whole player error-screens even though the video itself was playing fine; after switching audio tracks, the server can receive progress updates for a playback session that was already reported as stopped, so the admin dashboard and watch-state tracking can't be fully trusted; and my watch position on the server is only as reliable as a tangle of page-internal timers and handlers that nobody can test.

As the project owner, I also want a YouTube-style mini-player eventually — start a video, keep browsing the library, and have it keep playing docked in a corner. Today that is architecturally impossible: the entire playback lifecycle (session identity, progress reporting, stream setup, HLS wiring) is welded into the player page and dies with it on navigation.

As a maintainer, the domain glossary defines a "Play Session" — one continuous playback attempt of one item, identified by the server's PlaySessionId, where switching audio tracks ends one session and starts another — but no module in the codebase owns that concept. The lifecycle is smeared across the player page, a pass-through resolver, and the API client, the report payload is assembled in the page in raw wire format (violating the project's API-layering rule), and none of it is testable without mounting a real video element against a live server.

## Solution

Extract one deep **Play Session module** that owns the entire playback lifecycle: it takes an item id and a video element (both as reactive inputs, with no assumptions about who hosts it), and from there handles everything — fetching the item, asking the server how to play it (Direct Play preferred, then Transcode, then Direct Stream), attaching the stream to the element (HLS.js or native), resuming from the recorded position, reporting start/progress/stopped on the correct cadence, enforcing the audio-switch-ends-the-session invariant atomically, and guaranteeing exactly one Stopped report per session no matter how playback ends.

The player page shrinks to a thin host: it renders the module's state signals and forwards user gestures as commands. The wire format for playback reports drops fully below the API layer, which gains a domain-shaped reporting surface. The module is deliberately host-agnostic and exposes an explicit idempotent `stop()`, so a future persistent mini-player overlay can host the same session without any change to the module.

## User Stories

1. As a viewer, I want playback to continue uninterrupted when a progress-report request fails, so that a flaky connection to the server never error-screens a video that is playing fine.
2. As a viewer, I want to switch audio tracks mid-playback and have the video resume at the same position, so that changing language doesn't lose my place.
3. As a viewer, I want to resume a partially-watched item from its recorded position, so that I continue where I left off.
4. As a viewer, I want my watch position reported accurately when I leave the player, so that Continue Watching reflects reality.
5. As a viewer, I want to turn subtitles on, off, or switch between them without interrupting playback, so that subtitle choices are instant.
6. As a viewer, I want both original files (Direct Play) and server-transcoded streams (HLS) to play seamlessly, so that codec support is invisible to me.
7. As a viewer, I want the delivery-method badge (Direct Play / Direct Stream / Transcode) to stay accurate across audio switches, so that I can tell when the server is transcoding.
8. As a viewer, I want keyboard shortcuts (space, arrow seeking, mute, fullscreen) to keep working exactly as before, so that the refactor is invisible to my habits.
9. As a viewer, I want the player to return to the previous page when the video ends, so that navigation stays predictable.
10. As a viewer, I want pause and seek to be reflected on the server promptly rather than only at the next 10-second tick, so that my devices agree about where I am.
11. As an admin, I want the dashboard's active-session list to show correct position and pause state for web playback, so that I can trust what the server tells me.
12. As an admin, I want an audio-track switch to appear as one session ending and a new one starting, so that server-side session accounting stays truthful to the domain definition.
13. As an admin, I want exactly one Stopped report per session — on navigation, on explicit stop, or on video end — so that no ghost sessions linger on the dashboard.
14. As an admin, I want no progress reports to arrive for a session after its Stopped report, so that logs and watch-state never contradict themselves.
15. As a maintainer, I want the Play Session lifecycle testable with fake timers and a stub video surface, so that cadence, rotation, and teardown bugs are caught without a browser or a live server.
16. As a maintainer, I want the playback wire format confined to the API layer, so that the layering rule holds everywhere and server API changes touch one place.
17. As a maintainer, I want the audio-switch invariant to be a single atomic command on the module, so that no caller can end and restart sessions out of order.
18. As a maintainer, I want the progress timer owned by the session it reports for, so that a timer can never outlive its session.
19. As a maintainer, I want stream resolution (Direct Play → Transcode → Direct Stream) hidden behind the module, so that pages never see media-source wire shapes.
20. As a maintainer, I want the media-attachment mechanism (HLS.js vs native) behind a swappable port, so that tests run without HLS.js and a future engine change is local.
21. As a maintainer, I want track labels computed once behind the module interface, so that display fallbacks don't live in templates.
22. As a future mini-player user, I want to start a video and keep browsing while it plays docked in a corner, so that browsing and watching aren't mutually exclusive — this refactor must remove the architectural obstacle (session welded to the page) even though the docked UI ships later.
23. As a maintainer, I want an explicit idempotent stop command on the session, so that a persistent overlay host with a close button can end playback without being destroyed itself.
24. As a maintainer, I want the module documented in the glossary and an ADR recording the seam, so that future architecture reviews don't re-litigate it.

## Implementation Decisions

- One deep Play Session module lives in the features layer, replacing the existing pass-through play-item feature (which is deleted; its resolution ladder folds in as a private implementation detail).
- The module's factory takes two reactive inputs — the item id and the video element — and assumes nothing about its host. The player page is merely the first host; a future overlay widget is the second.
- The module binds directly to the video element: it attaches its own event listeners and mirrors element state (playing, position, duration, volume) into read-only signals. The element is typed structurally (a minimal video-surface contract) so tests can pass a plain stub object.
- Callers interact through commands only (toggle play, seek, set volume, mute, select audio, select subtitle, stop); they never write to the element directly. State flows out exclusively through signals.
- Selecting an audio track is one atomic command that internally ends the current server Play Session (final progress sample, Stopped report, timer cleared) and starts a new one (re-resolve with the new track, re-attach, resume at the sampled position, Start report). The operation is single-flight; a second switch during a switch is ignored.
- The PlaySessionId never appears on any public type — callers cannot mis-thread a session they never hold.
- The progress cadence (10 seconds, plus immediate reports on pause/seek/resume events) is module policy, not an option. Each timer belongs to one session record and is cleared synchronously before that session's Stopped is sent, fixing the current bug where the interval survives audio-switch restarts.
- Exactly-once Stopped is guaranteed through a single end-session funnel used by explicit stop, audio switch, item change, and host destruction; a generation guard discards stale async resolutions.
- Reporting is best-effort: report failures are swallowed and never affect playback state (deliberate behavior change — today a failed start report error-screens the player).
- Item fetching moves inside the module, so hosts hold only an item id.
- Media attachment (HLS.js versus native HLS via source assignment) moves behind a media-engine port with an injection-token default, making the engine swappable and the HLS.js dependency local to one file.
- The API layer's three report methods become domain-shaped (seconds, camelCase, explicit session identity object); the PascalCase wire payload, ticks conversion, and endpoint paths become private to the API layer, fixing the standing layering violation.
- "Video ended" handling stays with the host (navigate back today; close overlay tomorrow) — ending policy is host policy.
- Accepted behavior changes: brief re-mount during audio switch (the old session is honestly stopped first), and clean automatic restart if the hosted item id changes.
- Side effects recorded inline: a new ADR for the Play Session seam, a Media Engine entry in the domain glossary, and the project rules updated so pages never touch the playback API directly.

## Testing Decisions

- Tests target external behavior at module interfaces only — what a caller can observe (signals, spy-visible outgoing reports, media-engine attachments) — never internal fields or private functions. A good test would survive a full rewrite of the module internals.
- The Play Session module gets the primary suite: fake timers drive the cadence; a stub video surface (plain object satisfying the structural contract, dispatching real events) replaces the element; a spy playback API records report order and payloads; a fake media engine records attachments and can simulate fatal errors. Covered behaviors: idle-until-inputs-ready, resume seeking, cadence while playing and suppression while paused, event-driven immediate reports, atomic audio-switch rotation (old session's Stopped strictly before new session's Start, position carried, old timer provably dead), single-flight switching, idempotent stop, exactly-once Stopped on host destruction, report-failure resilience, fatal-media-error quiescence, and item-change rotation.
- The playback API's reworked reporting surface gets a direct wire-mapping suite: domain progress in, correct wire body out (field names, seconds-to-ticks, pause flag, seekability), correct endpoints for start/progress/stopped, and error swallowing.
- Prior art: the live-resource seam's spec (injection-context factory testing with a child environment injector, stubbed collaborators via providers, microtask settling, teardown assertions) — the same harness patterns apply.

## Out of Scope

- The mini-player overlay itself: the persistent app-shell widget, docked corner UI, shrink-on-navigate behavior, and any routing changes. This refactor only removes the architectural obstacle.
- Casting / remote playback targets, SyncPlay, playback queues and autoplay-next, trickplay previews, burned-in subtitle transcoding, and music/audio-only playback.
- Any visual redesign of the player controls; the player UI stays as it is.
- Server-side changes of any kind.

## Further Notes

- The refactor must keep build, lint (including the architecture-boundary linter), and tests green, and per project policy the result must be verified against a real Jellyfin server in a browser before committing (credentials are entered by the project owner).
- Manual verification checklist: Direct Play and transcoded playback, resume position, audio switch (new session visible on the admin dashboard, position carried), pause/seek freshness on the dashboard, subtitle toggling, video-end navigation, navigate-away session cleanup, and playback surviving a brief network interruption to the server.
- The three accepted behavior changes (report-failure resilience, audio-switch re-mount, item-change restart) should be called out in the ADR so future sessions don't mistake them for regressions.

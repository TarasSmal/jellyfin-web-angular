# Implementation issues — PRD: Play Session module

Derived from [prd-play-session-module.md](prd-play-session-module.md). Two vertical slices; each keeps build, lint, and tests green and is independently verifiable against a real Jellyfin server.

---

## Issue 1

### Title
[Playback] Session reports become domain-shaped and best-effort

### Description
The player page currently assembles the PascalCase playback-report wire DTO itself (an ADR-0002 violation) and treats a failed start report as a fatal playback error. Move report assembly below the API seam: the reporting methods accept a domain-shaped session progress value (seconds, camelCase), convert to wire format (ticks, PascalCase, endpoint paths) internally, and swallow HTTP failures — reporting is telemetry and must never break playback.

### User-visible outcome
A network blip or server hiccup during playback no longer error-screens a video that is playing fine; starting, pausing, seeking, and stopping still update the admin dashboard exactly as before.

### Scope
- New domain `SessionProgress` shape on the reporting surface; the wire report type becomes private to the API layer
- Seconds→ticks conversion, `CanSeek`, and endpoint paths move inside the API layer
- All three report methods resolve instead of rejecting on HTTP failure
- Player page call sites updated to pass the domain shape (page no longer names any PascalCase report field)
- Wire-mapping test suite: correct body fields and endpoints for start/progress/stopped; error swallowing

### Reuse notes
- Existing `PlaybackApi` service and `ApiConfig` — reworked in place, no new service
- Existing ticks helpers from the shared lib
- Test harness patterns from the live-resource spec (`HttpTestingController`, microtask settling)

### Dependencies
- None

### Acceptance criteria
- [ ] No PascalCase report field names appear above the API layer
- [ ] A rejected report request leaves playback running (verified by test and by a brief network interruption against a real server)
- [ ] Wire-mapping tests pass for all three endpoints (field names, ticks conversion, pause flag, seekability)
- [ ] Build, ESLint, steiger, and existing tests stay green

---

## Issue 2

### Title
[Playback] Play Session module owns the playback lifecycle

### Description
Extract the deep Play Session module (design C): a host-agnostic factory taking an item id and a video element as reactive inputs. The module fetches the item, resolves the stream (Direct Play → Transcode → Direct Stream), attaches it via a swappable media-engine port (HLS.js or native), binds directly to the element and mirrors its state into signals, runs the 10-second progress cadence per session, enforces the audio-switch-ends-the-session invariant as one atomic command, and guarantees exactly-once Stopped via an explicit idempotent `stop()` and host-destroy teardown. The player page becomes a thin host; the pass-through play-item feature is deleted.

### User-visible outcome
Playback looks and behaves the same, but the server is never lied to: an audio switch shows up on the admin dashboard as one session ending and a new one starting at the same position; no progress reports arrive after a session's Stopped; leaving the player always cleans up its dashboard session. Groundwork lands for a future mini-player (the session no longer assumes it lives in a page).

### Scope
- New `features/play-session` slice: the module, the media-engine port with HLS.js default, the private resolution ladder folded in from play-item
- Player page rewritten as host: renders module signals, forwards gestures as commands, keeps controls chrome / fullscreen / keyboard / ended-navigates-back
- `features/play-item` deleted; `ResolvedStream` dies as a public type; PlaySessionId appears on no public type
- Per-session progress timer (fixes the interval surviving audio-switch restarts); event-driven immediate reports on pause/seek/resume
- Interface test suite with fake timers, stub video surface, spy reporting API, fake media engine
- ADR for the seam, Media Engine glossary entry, project-rules line (pages never touch the playback API directly)

### Reuse notes
- Issue 1's domain-shaped `SessionProgress` reporting surface — consumed as-is
- Existing `itemRequest` builder + `httpResource` for the item fetch
- Existing subtitle/stream URL builders on `PlaybackApi`
- Injection-context factory, DestroyRef teardown, and spec harness conventions from the live-resource seam

### Dependencies
- Issue 1

### Acceptance criteria
- [ ] Player page holds no session state: no report calls, no timers, no stream/track signals, no HLS.js import
- [ ] Module tests cover: idle-until-ready, resume seek, cadence gating on pause, atomic audio-switch rotation (Stopped strictly before Start, position carried, old timer provably dead), single-flight switching, idempotent `stop()`, exactly-once Stopped on destroy, report-failure resilience, fatal-media-error quiescence, item-change rotation
- [ ] Manual verification on a real server: Direct Play and transcode both play; resume works; audio switch produces a new dashboard session at the carried position; pause/seek reflect promptly; navigating away removes the dashboard session
- [ ] steiger passes with the new slice and the deleted one; build, lint, all tests green

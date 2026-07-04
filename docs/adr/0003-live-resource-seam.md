# 0003 — Live Resource seam for socket-fresh reads and mutation choreography

**Status:** accepted (2026-07-03)

## Context

Every admin page re-implemented the same plumbing: socket subscribe + refcounted
feed start/stop + an unchecked `as` cast per push, and a try → toast → reload
block per mutation (three pages had drifted into three different
reload-on-error behaviors). Wire MessageType strings (`'Sessions'`,
`'RefreshProgress'`) were compared inside pages — an ADR-0002 leak. Eleven
pages carried ~15–25 lines each of this; the newest code duplicated it fastest.

## Decision

One deep module in `shared/api` (`live-resource.ts`) behind two functions:

- `liveResource(feed)` — snapshot mode: the feed registry supplies the request
  builder and payload type; socket pushes replace the value. `liveResource<T>(builder, { staleOn: topic })` —
  invalidation mode: matching events trigger a throttled reload, plus one
  reload on socket reconnect. `liveResource<T>(builder)` — plain resource with
  mutation choreography.
- `resource.mutate(action, success, error?)` / `injectMutation()` — run the
  action, toast the outcome, **refetch even on error** (a rejected change may
  still have altered server state), resolve a boolean; never throws.

Feeds and topics carry domain names (`'sessions'`, `'tasks'`, `'library'`);
the domain→wire map and the single unchecked cast live inside the module.
Toasts go through a `NOTIFIER` port declared in `shared/api` and bound to
`ToastService` in the app layer, so `shared/api` never imports `shared/ui`.

## Consequences

- Pages hold zero socket, lifecycle, throttle, or toast plumbing; a new
  snapshot feed costs one registry line and every consumer gets its type.
- Refetch-even-on-error is now a module invariant, not a per-page convention.
  **Exception:** draft pages (`admin-settings`, `admin-user`) keep their
  `linkedSignal` drafts, which reset on reload — they use `injectMutation()`
  and reload only on success. `create()` flows on users/libraries now refetch
  on failure too (previously success-only) — deliberate normalization.
- Push cadence (1.5 s) and stale throttle (2 s) are module policy, not
  options; a page wanting different timing edits `shared/api`.
- `mutate` returns only a boolean; a page needing the server's error detail
  must drop back to try/catch around the API service.
- A reload racing a snapshot push may briefly show the HTTP body; the next
  push corrects it within the cadence. Accepted instead of last-push-wins
  machinery.

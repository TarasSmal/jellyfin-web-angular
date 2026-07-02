# Phase 2 Handoff — Admin Dashboard

Read this at the start of the phase-2 session. It captures everything phase 1 established so the new session doesn't re-derive or re-litigate it.

## Project in one paragraph

A Peacock-inspired (dark, cinematic) Jellyfin web client in Angular, intended to eventually replace jellyfin-web entirely. Phase 1 (complete, on `main`) covers Movies + TV: connect/login, home rails, library browse, item detail, full HLS player with progress reporting, search. Phase 2 is the **admin dashboard**. Later phases: music, live TV.

## Locked decisions — do not reopen

| Decision | Detail |
|---|---|
| Architecture | Feature-Sliced Design: `app → pages → widgets → features → entities → shared`, imports only downward, enforced by `npm run lint:fsd` (steiger). Slices need segments (`ui/`, `model/`, `lib/`) with an `index.ts` public API |
| API layer | Hand-rolled Angular `HttpClient` behind `shared/api` — **not** `@jellyfin/sdk`. See `docs/adr/0002-hand-rolled-api-client.md`. Wire format (paths/params/DTOs) never leaks above `shared`. If admin typing gets painful, the sanctioned escape hatch is generating *types only* from the server's OpenAPI spec (`/api-docs/openapi.json`) |
| Styling | Tailwind v4 + custom tokens in `src/styles.css` (`bg`, `surface`, `surface-raised`, `border`, `text`, `text-muted`, `text-faint`, `accent`, `danger`; `aspect-poster`, `aspect-backdrop`). No Angular Material. Angular CDK + spartan-ng are installed for modals/popovers/menus — **not used yet**; admin UI (dialogs, tables, confirmations) is where they should start earning their keep |
| Angular idioms | v22, zoneless, standalone, signals. Server reads via `httpResource(() => requestBuilder(config))` where the builder lives in `shared/api` and returns `undefined` when unauthenticated (keeps the resource idle). Mutations via small `providedIn: 'root'` API services using `firstValueFrom`. Page-local stores (`providers: [Store]` on the page) when accumulation/state is needed — see `pages/library/model/library-browser.ts` |
| Design bar | "Inspired-by" Peacock, not a pixel clone. Ship function first, refine visuals iteratively |
| Platforms | Desktop-first, responsive to mobile. No TV/D-pad |

## What already exists that phase 2 will reuse

- `shared/api/api-config.ts` — `ApiConfig`: server URL, token, userId signals; `config.url(path)`.
- `shared/api/auth-interceptor.ts` — attaches the MediaBrowser header to every request aimed at the server; admin endpoints need nothing extra.
- `entities/user/model/session-store.ts` — **`SessionStore.isAdmin`** computed already exists (from `Policy.IsAdministrator`); use it for an `adminGuard` alongside the existing `authGuard`/`connectedGuard` in `features/auth/model/guards.ts`.
- `widgets/app-shell` — top nav; an "Admin" link should render only when `isAdmin()`.
- `shared/ui/toast.ts` — `ToastService` for operation feedback (admin actions will want this a lot).
- `shared/lib/ticks.ts`, `shared/lib/clock.ts` — time conversions.
- Request-builder pattern examples: `shared/api/items-api.ts`.

## Suggested phase-2 scope (to be confirmed by interview, not assumed)

Jellyfin's admin surface is huge. A sane tracer-bullet order, each step verifiable against the real server:

1. **Dashboard overview** — `GET /System/Info`, active `GET /Sessions` (who's watching what, with progress), `GET /ScheduledTasks` running state. Route `pages/admin-dashboard` at `/admin`.
2. **Activity log** — `GET /System/ActivityLog/Entries` (paged table; first real table → spartan-ng).
3. **Users** — `GET/POST /Users`, policy editing (`POST /Users/{id}/Policy`), password reset, enable/disable.
4. **Libraries** — `GET /Library/VirtualFolders`, add/remove folders, trigger scans (`POST /Library/Refresh`).
5. **Scheduled tasks** — list/run/stop (`/ScheduledTasks/Running/{id}`).
6. Later: server settings (`/System/Configuration`), plugins, transcoding config.

FSD placement: new slices `pages/admin-*`, `entities/session` (active playback sessions), `entities/admin-user` or extend `entities/user` carefully, `features/run-task`, `features/edit-user-policy`, etc. New wire calls go in `shared/api/` as new files (`system-api.ts` exists; add `sessions-api.ts`, `admin-users-api.ts`, `library-admin-api.ts`, `tasks-api.ts`). Nothing existing should need modification beyond the app-shell admin link and new routes.

Admin API note: all admin endpoints authorize via the same token — the server checks the user's admin policy; there is no separate auth flow. WebSocket (`/socket`) exists for live session updates; polling `GET /Sessions` every ~10s is the simpler phase-2 start.

## Dev + verification workflow

- `npm start` (dev server), `npm run build`, `npm run lint` (ESLint + steiger), `npm test`.
- Verify every step against the real server in a browser (Playwright MCP available). Test server: `http://192.168.88.23:8096`, user `qnasyst` (is an admin; media metadata is Ukrainian). **The user types his password himself** in the browser when a fresh login is needed — ask, don't handle credentials.
- Commit per completed tracer-bullet step; keep `CONTEXT.md` (glossary-only) and `docs/adr/` updated as terms/decisions crystallise.

## Gotchas learned in phase 1

- TypeScript 6: `baseUrl` is deprecated — path aliases in `tsconfig.json` use `./src/...` entries without it.
- Jellyfin may collapse movies into BoxSets per server display preferences — browse calls pass `collapseBoxSetItems: false`.
- Resume ("Continue Watching") only registers past ~5% watched — not a bug.
- Media elements can't send the auth header; stream/image-adjacent URLs carry `api_key=` as a query param (see `PlaybackApi`).
- steiger fails slices without segments — don't put `.ts` files directly in a slice root.

## Glossary & ADRs

- `CONTEXT.md` — Item, Library/View, Rail, Hero Billboard, Continue Watching vs Next Up, Direct Play vs Transcode, Play Session.
- `docs/adr/0001-feature-sliced-design.md`, `docs/adr/0002-hand-rolled-api-client.md`.

## Suggested opening prompt for the new session

> Read docs/phase-2-admin-dashboard-handoff.md, then plan and build phase 2 (admin dashboard). Confirm the scope order with me before scaffolding.

# jellyfin-web-angular

Peacock-inspired Jellyfin web client (Angular 22, zoneless, signals, Tailwind v4). Long-term goal: full jellyfin-web replacement. Phase 1 (movies + TV: auth, home rails, library, item detail, HLS player, search) is complete. Phase 2 = admin dashboard — **read `docs/phase-2-admin-dashboard-handoff.md` before starting it.**

## Commands

- `npm start` — dev server
- `npm run build` — must stay green
- `npm run lint` — ESLint + steiger FSD boundary lint (both must pass)
- `npm test` — Vitest

## Architecture (Feature-Sliced Design)

Layers: `app → pages → widgets → features → entities → shared`. Import only downward, via aliases (`@pages/*`, `@widgets/*`, `@features/*`, `@entities/*`, `@shared/*`) and each slice's `index.ts`. Slices need segments (`ui/`, `model/`, `lib/`) — steiger fails bare files in a slice root.

## Hard rules

- All Jellyfin wire format (paths, params, DTOs) lives in `shared/api` only (ADR 0002). No `@jellyfin/sdk`.
- Server reads: `httpResource(() => someRequest(config))` with request builders from `shared/api` that return `undefined` when unauthenticated. Mutations: API services with `firstValueFrom`.
- Styling: Tailwind tokens from `src/styles.css` (`bg`, `surface`, `accent`, …). No Angular Material; use Angular CDK/spartan-ng for overlay primitives.
- `CONTEXT.md` is a glossary only — no implementation details. Decisions with real trade-offs get an ADR in `docs/adr/`.
- Verify each feature against the real Jellyfin server in a browser before committing; the user enters his own credentials.

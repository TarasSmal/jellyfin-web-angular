# 0001 — Feature-Sliced Design instead of Angular-conventional structure

**Status:** accepted (2026-07-02)

## Context

This app aims to eventually replace jellyfin-web entirely (movies/TV first, then admin dashboard, music, live TV). That means the codebase must absorb large, unrelated feature areas over years without existing code being touched. Angular convention would be domain folders or Nx workspace libs; neither was chosen.

## Decision

Use Feature-Sliced Design layers inside a single Angular CLI workspace: `app → pages → widgets → features → entities → shared`, with path aliases (`@pages/*` etc.) and the import direction enforced by steiger (`npm run lint:fsd`). A layer may only import from layers below it.

## Consequences

- New feature areas (admin, music) land as new slices in `pages`/`features`/`entities` without modifying existing slices.
- Angular developers joining the project will not recognize the layout; FSD is the reference (https://feature-sliced.design).
- No Nx: we accept losing per-lib build caching because a single app doesn't need it; steiger provides the boundary enforcement that Nx tags would have.
- Reversing this later means moving every file; effectively irreversible once slices multiply.

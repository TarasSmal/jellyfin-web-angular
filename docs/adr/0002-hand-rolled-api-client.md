# 0002 — Hand-rolled HttpClient API layer instead of @jellyfin/sdk

**Status:** accepted (2026-07-02)

## Context

Jellyfin publishes an official TypeScript SDK (`@jellyfin/sdk`, axios-based, generated from the server's OpenAPI spec) with full typed coverage of every endpoint. Using it would make the eventual admin-dashboard phase cheaper to type. But it brings axios alongside Angular's HttpClient, bypasses Angular interceptors/`httpResource`, and ships types for hundreds of endpoints we may never call.

## Decision

All server communication is hand-rolled on Angular's `HttpClient`, living exclusively in `shared/api`. DTO interfaces are hand-written for only the endpoints and fields we actually use, cribbing shapes from the Jellyfin OpenAPI spec (`/api-docs/openapi.json` on any server) rather than inventing them. No layer above `shared` may know the wire format.

## Consequences

- Angular-native: auth via interceptor, reactive data via `httpResource`, one HTTP stack, leaner bundle.
- Every new endpoint costs a hand-written wrapper + types; this grows linearly as scope approaches full jellyfin-web replacement. If the typing burden becomes painful (likely at the admin phase), the escape hatch is generating types-only from the OpenAPI spec — the `shared/api` boundary makes that swap invisible to the rest of the app.
- Wire types must be kept honest against the server manually; there is no generated source of truth in-repo.

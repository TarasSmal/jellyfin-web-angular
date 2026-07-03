# jellyfin-web-angular

A modern web client for [Jellyfin](https://jellyfin.org/), built from scratch with **Angular 22** — zoneless, signal-based, and styled with **Tailwind CSS v4**. The long-term goal is a full, drop-in replacement for the stock `jellyfin-web` client.

> **Status** — Phase 1 (movies & TV) is complete: authentication, home rails, library browsing, item detail, HLS playback, and search. Phase 2 (admin dashboard) is in progress.

## Highlights

- **Zoneless, signal-first Angular 22** — no Zone.js; state is modeled with signals, derived state with `computed()`, and server reads with `httpResource`.
- **Rail-based browsing** — a hero billboard plus horizontally scrolling rails (Continue Watching, Next Up, Latest) on the home page.
- **Full HLS player** — direct play when the browser supports the codec, server-side transcode to HLS otherwise, with audio/subtitle track selection and playback progress reporting.
- **Live admin dashboard** — sessions, system info, scheduled tasks, users, devices, API keys, plugins, and logs, kept current over a **WebSocket** connection instead of polling.
- **Hand-rolled Jellyfin API client** — no `@jellyfin/sdk`; all wire format lives in one place (`shared/api`), keeping the rest of the app free of Jellyfin DTO shapes.
- **Feature-Sliced Design** — a layered architecture (`app → pages → widgets → features → entities → shared`) enforced by lint, built to absorb large new feature areas without touching existing code.

## Tech stack

| Concern | Choice |
| --- | --- |
| Framework | Angular 22 (standalone, zoneless, signals) |
| Styling | Tailwind CSS v4 (design tokens in `src/styles.css`) |
| Overlays | Angular CDK + [spartan-ng](https://www.spartan.ng/) |
| Playback | [hls.js](https://github.com/video-dev/hls.js) |
| Architecture | [Feature-Sliced Design](https://feature-sliced.design/), enforced by [steiger](https://github.com/feature-sliced/steiger) |
| Testing | Vitest |
| Linting | ESLint (angular-eslint) + steiger FSD boundaries |

## Getting started

Requires Node.js and npm, plus a running Jellyfin server to connect to.

```bash
npm install
npm start        # dev server at http://localhost:4200
```

On first launch, the app prompts for your Jellyfin server URL, then your credentials — no configuration files or secrets are committed.

### Scripts

| Command | Description |
| --- | --- |
| `npm start` | Dev server with live reload |
| `npm run build` | Production build to `dist/` |
| `npm run lint` | ESLint + steiger FSD boundary checks (both must pass) |
| `npm test` | Unit tests with Vitest |

## Architecture

The codebase follows **Feature-Sliced Design**: layers may only import downward, via path aliases (`@pages/*`, `@widgets/*`, `@features/*`, `@entities/*`, `@shared/*`) and each slice's `index.ts`.

```
app → pages → widgets → features → entities → shared
```

A few load-bearing rules:

- **All Jellyfin wire format** (paths, params, DTOs) lives in `shared/api` only — the rest of the app never imports Jellyfin types directly ([ADR 0002](docs/adr/0002-hand-rolled-api-client.md)).
- **Server reads** use `httpResource()` with request builders that return `undefined` when unauthenticated; **mutations** go through API services.
- **Live reads** stay current via WebSocket push rather than polling.

See [`docs/adr/`](docs/adr/) for the architectural decisions and [`CONTEXT.md`](CONTEXT.md) for the domain glossary.

## Roadmap

- [x] **Phase 1** — Movies & TV: auth, home rails, library browse, item detail, HLS player, search
- [ ] **Phase 2** — Admin dashboard (in progress)
- [ ] Music
- [ ] Live TV & DVR

## License

Released under the [MIT License](LICENSE). Not affiliated with the Jellyfin project.

# Context

Glossary of the language used in this project. Terms are added as they crystallise; implementation details do not belong here.

## Terms

**Item** — Any playable or browsable media object served by Jellyfin: a Movie, Series, Season, or Episode. Jellyfin models all of these with one shape; the *kind* of item distinguishes them.

**Library** — A user-visible collection of items of one kind (e.g. "Movies", "TV Shows"), as configured on the server. Jellyfin calls these "user views".

**Rail** — A horizontally scrolling row of item cards on the home page (e.g. "Continue Watching", "Latest Movies"). Peacock-style browsing is built from rails.

**Hero Billboard** — The large featured-item banner at the top of the home page: backdrop image, title, and call-to-action.

**Continue Watching** — Items the user has partially played, resumable from where they left off. Distinct from Next Up.

**Next Up** — The next unwatched episode of each series the user is actively watching. Episode-only; never contains movies.

**Direct Play** — Playback where the browser plays the original file untouched; server does no work.

**Transcode** — Playback where the server converts the file (usually to HLS) because the browser cannot play the original codec/container.

**Play Session** — One continuous playback attempt of one item, identified by the server's PlaySessionId. Progress reports belong to a session; switching audio tracks ends one session and starts another.

**View** — Jellyfin's name for what users see as a Library. The API says "views"; this project says Library everywhere outside `shared/api`.

**Live Resource** — A server read that stays current by socket push instead of polling. Two flavours: a *snapshot feed* replaces the whole value on every push (sessions, scheduled tasks); an *invalidation event* only marks the read stale so it refetches (library changes). Feeds and events carry domain names; the wire message names stay inside `shared/api`.

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

**Play Session** — One continuous playback attempt of one item, identified by the server's PlaySessionId. Progress reports belong to a session; switching audio tracks ends one session and starts another. Owned by the Play Session module, which binds to a video surface and hosts the whole lifecycle; a page or a future mini-player is merely its host.

**Media Engine** — The mechanism that wires a resolved stream to a video surface: HLS.js when the surface can't play HLS natively, a native `src` assignment otherwise. A swappable port so the engine can change in one place and tests can attach without HLS.js.

**Up Next card** — The countdown card shown when an episode ends and an Episode Neighbor exists next: it advertises that episode and auto-advances after ten seconds unless the viewer plays it immediately or cancels. After several consecutive hands-off auto-advances it asks "Are you still watching?" instead and waits indefinitely; any deliberate gesture during playback resets that guard. Movies and series finales never show it; their endings exit the player as before.

**View** — Jellyfin's name for what users see as a Library. The API says "views"; this project says Library everywhere outside `shared/api`.

**Episode Neighbors** — The previous and next episode of the one currently hosted, in series play order across season boundaries. Undefined at the series' first/last episode and for anything that isn't an episode. Powers in-player episode navigation; unrelated to Next Up, which spans *series*, not adjacent episodes.

**Chapter** — A named position on one item's timeline, embedded in the media file's metadata and served by Jellyfin as part of the item. Powers the seek bar's chapter marks; a chapter *contains* every moment from its start until the next chapter's start. Unnamed chapters are presented as "Chapter N". Distinct from media segments (server-side intro/credits detection), which this client does not use.

**Chapter Mark** — The visual tick on the seek bar at a chapter's start. Marks are guidance, not targets: seeking never snaps to them; hovering or scrubbing the track reveals the containing chapter's name.

**Live Resource** — A server read that stays current by socket push instead of polling. Two flavours: a *snapshot feed* replaces the whole value on every push (sessions, scheduled tasks); an *invalidation event* only marks the read stale so it refetches (library changes). Feeds and events carry domain names; the wire message names stay inside `shared/api`.

import {
  DestroyRef,
  Signal,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { httpResource } from '@angular/common/http';
import {
  ApiConfig,
  BaseItemDto,
  MediaSourceInfo,
  PlayMethod,
  PlaybackApi,
  SessionProgress,
  itemRequest,
} from '@shared/api';
import { ticksToSeconds } from '@shared/lib/ticks';
import { Chapter, chaptersOf } from './chapter-timeline';
import { MEDIA_ENGINE, MediaAttachment, VideoSurface } from './media-engine';
import { ResolvedStream, resolveStream } from './stream-resolution';

const PROGRESS_INTERVAL_MS = 10_000;

// Stall-at-tail watchdog: a transcode can deliver less media than its playlist
// advertises (e.g. a dub audio track that ends before the credits). Playback
// then freezes at the end of the buffer, short of the advertised duration, and
// 'ended' never fires. Frozen playhead + frozen buffer this close to the end
// is finished in every sense the viewer cares about.
const STALL_TICK_MS = 1_000;
const STALL_TICKS_TO_END = 5;
const STALL_TAIL_SECONDS = 20;
const STALL_EPSILON_SECONDS = 0.25;

/** A selectable track (audio or subtitle) with its display label resolved. */
export interface TrackOption {
  index: number;
  label: string;
}

/** An external subtitle ready for a `<track>` element. */
export interface ActiveSubtitle {
  url: string;
  label: string;
}

/**
 * The Play Session module's public surface. State flows out through read-only
 * signals; callers act only through the commands. The PlaySessionId never
 * appears here — a caller cannot mis-thread a session it never holds.
 */
export interface PlaySession {
  readonly loading: Signal<boolean>;
  readonly error: Signal<boolean>;
  readonly ended: Signal<boolean>;
  readonly playing: Signal<boolean>;
  readonly position: Signal<number>;
  readonly duration: Signal<number>;
  readonly volume: Signal<number>;
  readonly muted: Signal<boolean>;
  readonly item: Signal<BaseItemDto | undefined>;
  /** The hosted item's Chapters, ordered, in seconds; empty when it has none. */
  readonly chapters: Signal<Chapter[]>;
  readonly method: Signal<PlayMethod | null>;
  readonly audioTracks: Signal<TrackOption[]>;
  readonly subtitleTracks: Signal<TrackOption[]>;
  readonly selectedAudio: Signal<number | undefined>;
  readonly selectedSubtitle: Signal<number | null>;
  readonly activeSubtitle: Signal<ActiveSubtitle[]>;

  togglePlay(): void;
  seek(seconds: number): void;
  setVolume(value: number): void;
  toggleMute(): void;
  selectAudio(index: number): void;
  selectSubtitle(index: number | null): void;
  stop(): void;
}

/** One server-side Play Session's bookkeeping. Its timer never outlives it. */
interface SessionRecord {
  gen: number;
  itemId: string;
  source: MediaSourceInfo;
  playSessionId: string;
  method: PlayMethod;
  audioIndex: number | undefined;
  attachment: MediaAttachment;
  timer: ReturnType<typeof setInterval> | null;
}

/**
 * Create a Play Session bound to a reactive item id and video surface. Must be
 * called in an injection context; teardown (final Stopped) is tied to that
 * context's destruction. The host is anonymous — a page today, a docked
 * mini-player tomorrow.
 */
export function createPlaySession(
  itemId: () => string,
  surface: () => VideoSurface | null,
): PlaySession {
  return new PlaySessionController(itemId, surface);
}

class PlaySessionController implements PlaySession {
  private readonly api = inject(PlaybackApi);
  private readonly config = inject(ApiConfig);
  private readonly engine = inject(MEDIA_ENGINE);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly ended = signal(false);
  readonly playing = signal(false);
  readonly position = signal(0);
  readonly duration = signal(0);
  readonly volume = signal(1);
  readonly muted = signal(false);
  readonly method = signal<PlayMethod | null>(null);
  readonly selectedAudio = signal<number | undefined>(undefined);
  readonly selectedSubtitle = signal<number | null>(null);

  readonly item: Signal<BaseItemDto | undefined>;

  readonly chapters = computed<Chapter[]>(() => {
    const item = this.item();
    return item ? chaptersOf(item) : [];
  });

  private readonly source = signal<MediaSourceInfo | null>(null);

  readonly audioTracks = computed<TrackOption[]>(() =>
    (this.source()?.MediaStreams ?? [])
      .filter((s) => s.Type === 'Audio')
      .map((s) => ({ index: s.Index, label: s.DisplayTitle ?? s.Language ?? `Audio ${s.Index}` })),
  );

  readonly subtitleTracks = computed<TrackOption[]>(() =>
    (this.source()?.MediaStreams ?? [])
      .filter((s) => s.Type === 'Subtitle' && (s.IsTextSubtitleStream || s.DeliveryMethod === 'External'))
      .map((s) => ({ index: s.Index, label: s.DisplayTitle ?? s.Language ?? `Sub ${s.Index}` })),
  );

  readonly activeSubtitle = computed<ActiveSubtitle[]>(() => {
    const source = this.source();
    const index = this.selectedSubtitle();
    if (!source || index === null) return [];
    const track = this.subtitleTracks().find((t) => t.index === index);
    if (!track) return [];
    return [{ url: this.api.subtitleUrl(this.itemId(), source.Id, index), label: track.label }];
  });

  /** Bumped every session start; guards stale async resolutions and timers. */
  private gen = 0;
  private active: SessionRecord | null = null;
  private switching = false;
  private startedFor: string | null = null;

  constructor(
    private readonly itemId: () => string,
    private readonly surface: () => VideoSurface | null,
  ) {
    const resource = httpResource<BaseItemDto>(() => itemRequest(this.config, this.itemId()));
    this.item = resource.value;

    // Bind to the element whenever it appears or changes; mirror its state out.
    effect((onCleanup) => this.bindSurface(onCleanup));

    // Start once item metadata (for the resume position) and the surface are in;
    // a changed item id rotates the session.
    effect(() => {
      if (resource.error()) {
        this.error.set(true);
        this.loading.set(false);
        return;
      }
      const item = resource.value();
      const surface = this.surface();
      if (!item || !surface) return;
      if (this.startedFor === item.Id) return;
      untracked(() => {
        if (this.startedFor !== null) this.endSession();
        this.startedFor = item.Id;
        void this.startSession(item);
      });
    });

    this.destroyRef.onDestroy(() => this.endSession());
  }

  // --- commands ---

  togglePlay(): void {
    const surface = this.surface();
    if (!surface) return;
    if (surface.paused) void surface.play();
    else surface.pause();
  }

  seek(seconds: number): void {
    const surface = this.surface();
    if (!surface) return;
    surface.currentTime = seconds;
    this.position.set(seconds);
    this.reportProgress();
  }

  setVolume(value: number): void {
    const surface = this.surface();
    if (surface) surface.volume = value;
  }

  toggleMute(): void {
    const surface = this.surface();
    if (surface) surface.muted = !surface.muted;
  }

  async selectAudio(index: number): Promise<void> {
    if (this.switching) return; // single-flight: ignore a switch during a switch
    const item = this.item();
    if (!item || index === this.selectedAudio()) return;
    this.switching = true;
    const position = this.position();
    try {
      // Atomic rotation: the old session is honestly stopped (final sample,
      // Stopped, timer cleared) strictly before the new one starts.
      this.endSession();
      await this.startSession(item, index, position);
    } finally {
      this.switching = false;
    }
  }

  selectSubtitle(index: number | null): void {
    this.selectedSubtitle.set(index);
  }

  stop(): void {
    this.surface()?.pause();
    this.endSession();
  }

  // --- lifecycle ---

  private async startSession(
    item: BaseItemDto,
    audioIndex?: number,
    resumeAt?: number,
  ): Promise<void> {
    const gen = ++this.gen;
    this.loading.set(true);
    this.error.set(false);
    // A rotated session is a fresh playback attempt; ended must not latch
    // across items or auto-advance would work exactly once (ADR 0004).
    this.ended.set(false);

    let stream: ResolvedStream;
    try {
      stream = await resolveStream(this.api, item.Id, { audioStreamIndex: audioIndex });
    } catch {
      if (gen === this.gen) {
        this.error.set(true);
        this.loading.set(false);
      }
      return;
    }
    if (gen !== this.gen) return; // superseded while resolving

    const surface = this.surface();
    if (!surface) {
      this.loading.set(false);
      return;
    }

    const attachment = this.engine.attach(
      surface,
      { url: stream.url, isHls: stream.isHls },
      () => {
        if (gen !== this.gen) return; // fatal error from a session already ended
        this.error.set(true);
        this.endSession();
      },
    );

    const startAt = resumeAt ?? ticksToSeconds(item.UserData?.PlaybackPositionTicks ?? 0);
    if (startAt > 1) {
      surface.addEventListener('loadedmetadata', () => (surface.currentTime = startAt), {
        once: true,
      });
    }

    const record: SessionRecord = {
      gen,
      itemId: item.Id,
      source: stream.mediaSource,
      playSessionId: stream.playSessionId,
      method: stream.method,
      audioIndex: audioIndex ?? stream.mediaSource.DefaultAudioStreamIndex,
      attachment,
      timer: null,
    };
    this.active = record;
    this.source.set(stream.mediaSource);
    this.method.set(stream.method);
    this.selectedAudio.set(record.audioIndex);

    this.fire(this.api.reportStart(this.sampleFor(record)));
    record.timer = setInterval(() => {
      if (this.playing()) this.fire(this.api.reportProgress(this.sampleFor(record)));
    }, PROGRESS_INTERVAL_MS);
    this.loading.set(false);
  }

  /**
   * The single end-session funnel: explicit stop, audio switch, item change,
   * and host destruction all pass through here. Idempotent — a second call
   * finds no active session and no-ops — so Stopped is sent exactly once. The
   * timer is cleared synchronously before Stopped, so it can never outlive its
   * session; bumping the generation abandons any in-flight start.
   */
  private endSession(): void {
    const record = this.active;
    if (!record) return;
    this.active = null;
    this.gen++;
    if (record.timer !== null) clearInterval(record.timer);
    this.fire(this.api.reportStopped(this.sampleFor(record)));
    record.attachment.detach();
  }

  private bindSurface(onCleanup: (fn: () => void) => void): void {
    const surface = this.surface();
    if (!surface) return;

    // Sync current state in case play/volume events fired before we bound.
    this.playing.set(!surface.paused);
    this.position.set(surface.currentTime);
    this.volume.set(surface.volume);
    this.muted.set(surface.muted);

    const onPlay = () => {
      this.playing.set(true);
      this.reportProgress(); // event-driven freshness on resume
    };
    const onPause = () => {
      this.playing.set(false);
      this.reportProgress();
    };
    const onTime = () => {
      this.position.set(surface.currentTime);
      if (Number.isFinite(surface.duration)) this.duration.set(surface.duration);
    };
    const onVolume = () => {
      this.volume.set(surface.volume);
      this.muted.set(surface.muted);
    };
    const onEnded = () => {
      this.endSession();
      this.ended.set(true); // ending policy is the host's
    };

    // Watchdog for streams that end short of their advertised duration; treats
    // a frozen playhead + frozen buffer near the tail as the missing 'ended'.
    // Mid-episode rebuffering never trips it: there the buffer end keeps
    // growing, and a stall further from the end is a real problem to surface.
    let frozenTicks = 0;
    let lastPosition = -1;
    let lastBufferEnd = -1;
    const watchdog = setInterval(() => {
      if (surface.paused || !this.active) {
        frozenTicks = 0;
        return;
      }
      const position = surface.currentTime;
      const bufferEnd = surface.buffered.length
        ? surface.buffered.end(surface.buffered.length - 1)
        : 0;
      const frozen =
        Math.abs(position - lastPosition) < STALL_EPSILON_SECONDS &&
        Math.abs(bufferEnd - lastBufferEnd) < STALL_EPSILON_SECONDS;
      lastPosition = position;
      lastBufferEnd = bufferEnd;
      frozenTicks = frozen ? frozenTicks + 1 : 0;
      const nearEnd =
        Number.isFinite(surface.duration) &&
        surface.duration > 0 &&
        surface.duration - position <= STALL_TAIL_SECONDS;
      // At the buffer's end, not stranded behind it — a seek into the
      // unbuffered tail waits for the transcoder, it doesn't end.
      const consumedBuffer = Math.abs(bufferEnd - position) <= 1;
      if (frozenTicks >= STALL_TICKS_TO_END && nearEnd && consumedBuffer) {
        frozenTicks = 0;
        onEnded();
      }
    }, STALL_TICK_MS);

    surface.addEventListener('play', onPlay);
    surface.addEventListener('pause', onPause);
    surface.addEventListener('timeupdate', onTime);
    surface.addEventListener('durationchange', onTime);
    surface.addEventListener('volumechange', onVolume);
    surface.addEventListener('ended', onEnded);

    onCleanup(() => {
      clearInterval(watchdog);
      surface.removeEventListener('play', onPlay);
      surface.removeEventListener('pause', onPause);
      surface.removeEventListener('timeupdate', onTime);
      surface.removeEventListener('durationchange', onTime);
      surface.removeEventListener('volumechange', onVolume);
      surface.removeEventListener('ended', onEnded);
    });
  }

  private reportProgress(): void {
    if (this.active) this.fire(this.api.reportProgress(this.sampleFor(this.active)));
  }

  private sampleFor(record: SessionRecord): SessionProgress {
    return {
      itemId: record.itemId,
      mediaSourceId: record.source.Id,
      playSessionId: record.playSessionId,
      positionSeconds: this.position(),
      paused: !this.playing(),
      playMethod: record.method,
      audioStreamIndex: record.audioIndex,
    };
  }

  /** Reporting is best-effort; a failure never touches playback state. */
  private fire(report: Promise<void>): void {
    void report.catch(() => undefined);
  }
}

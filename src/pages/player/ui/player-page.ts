import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { httpResource } from '@angular/common/http';
import { Location } from '@angular/common';
import Hls from 'hls.js';
import { ApiConfig, BaseItemDto, PlaybackApi, itemRequest } from '@shared/api';
import { PlayItem, ResolvedStream } from '@features/play-item';
import { episodeCode } from '@entities/item';
import { formatClock } from '@shared/lib/clock';
import { secondsToTicks, ticksToSeconds } from '@shared/lib/ticks';

const PROGRESS_INTERVAL_MS = 10_000;
const CONTROLS_TIMEOUT_MS = 3_000;

@Component({
  selector: 'app-player-page',
  template: `
    <div
      #container
      class="fixed inset-0 z-50 bg-black"
      [class.cursor-none]="!controlsVisible()"
      (mousemove)="poke()"
    >
      <video
        #video
        class="h-full w-full"
        autoplay
        crossorigin="anonymous"
        (click)="togglePlay()"
        (play)="onPlay()"
        (pause)="onPause()"
        (ended)="onEnded()"
        (timeupdate)="onTimeUpdate()"
        (durationchange)="onTimeUpdate()"
        (volumechange)="onVolumeChange()"
      >
        @for (sub of activeSubtitle(); track sub.url) {
          <track kind="subtitles" [src]="sub.url" [label]="sub.label" default />
        }
      </video>

      @if (loading()) {
        <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div class="h-12 w-12 animate-spin rounded-full border-2 border-border border-t-accent"></div>
        </div>
      }

      @if (error()) {
        <div class="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <p class="text-danger">Playback failed.</p>
          <button type="button" class="rounded-lg border border-border px-4 py-2 text-sm" (click)="goBack()">
            Go back
          </button>
        </div>
      }

      <!-- Top bar -->
      <div
        class="absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 to-transparent px-6 py-4 transition-opacity"
        [class.opacity-0]="!controlsVisible()"
        [class.pointer-events-none]="!controlsVisible()"
      >
        <div class="flex items-center gap-4">
          <button type="button" class="text-text-muted transition-colors hover:text-text" (click)="goBack()" title="Back">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5m7-7-7 7 7 7" />
            </svg>
          </button>
          <div>
            <p class="font-semibold">{{ title() }}</p>
            @if (subtitleLine(); as line) {
              <p class="text-xs text-text-muted">{{ line }}</p>
            }
          </div>
          <span class="ml-auto rounded border border-border px-1.5 py-0.5 text-xs text-text-faint">
            {{ stream()?.method }}
          </span>
        </div>
      </div>

      <!-- Bottom controls -->
      <div
        class="absolute inset-x-0 bottom-0 space-y-2 bg-gradient-to-t from-black/90 to-transparent px-6 pt-10 pb-4 transition-opacity"
        [class.opacity-0]="!controlsVisible()"
        [class.pointer-events-none]="!controlsVisible()"
      >
        <input
          type="range"
          class="w-full accent-accent"
          min="0"
          [max]="duration()"
          step="0.1"
          [value]="currentTime()"
          (input)="onSeek($event)"
        />
        <div class="flex items-center gap-4">
          <button type="button" class="transition-colors hover:text-accent" (click)="togglePlay()" [title]="playing() ? 'Pause' : 'Play'">
            @if (playing()) {
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zm8 0h4v16h-4z" /></svg>
            } @else {
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            }
          </button>

          <span class="text-sm tabular-nums text-text-muted">
            {{ clock(currentTime()) }} / {{ clock(duration()) }}
          </span>

          <span class="flex-1"></span>

          @if (audioTracks().length > 1) {
            <select
              class="max-w-44 rounded border border-border bg-surface px-2 py-1 text-xs"
              [value]="selectedAudio()"
              (change)="onAudioChange($event)"
              title="Audio track"
            >
              @for (track of audioTracks(); track track.Index) {
                <option [value]="track.Index">{{ track.DisplayTitle ?? track.Language ?? 'Audio ' + track.Index }}</option>
              }
            </select>
          }

          @if (subtitleTracks().length) {
            <select
              class="max-w-44 rounded border border-border bg-surface px-2 py-1 text-xs"
              [value]="selectedSubtitle() ?? ''"
              (change)="onSubtitleChange($event)"
              title="Subtitles"
            >
              <option value="">Subtitles off</option>
              @for (track of subtitleTracks(); track track.Index) {
                <option [value]="track.Index">{{ track.DisplayTitle ?? track.Language ?? 'Sub ' + track.Index }}</option>
              }
            </select>
          }

          <input
            type="range"
            class="w-24 accent-accent"
            min="0"
            max="1"
            step="0.05"
            [value]="volume()"
            (input)="onVolume($event)"
            title="Volume"
          />

          <button type="button" class="transition-colors hover:text-accent" (click)="toggleFullscreen()" title="Fullscreen">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  `,
  host: {
    '(document:keydown)': 'onKey($event)',
  },
})
export class PlayerPage {
  private readonly config = inject(ApiConfig);
  private readonly playbackApi = inject(PlaybackApi);
  private readonly playItem = inject(PlayItem);
  private readonly location = inject(Location);
  private readonly destroyRef = inject(DestroyRef);

  /** Route param via withComponentInputBinding. */
  readonly id = input.required<string>();

  private readonly videoRef = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private readonly containerRef = viewChild.required<ElementRef<HTMLDivElement>>('container');

  protected readonly item = httpResource<BaseItemDto>(() => itemRequest(this.config, this.id()));
  protected readonly stream = signal<ResolvedStream | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly playing = signal(false);
  protected readonly currentTime = signal(0);
  protected readonly duration = signal(0);
  protected readonly volume = signal(1);
  protected readonly controlsVisible = signal(true);
  protected readonly selectedAudio = signal<number | undefined>(undefined);
  protected readonly selectedSubtitle = signal<number | null>(null);

  private hls: Hls | null = null;
  private progressTimer: ReturnType<typeof setInterval> | null = null;
  private controlsTimer: ReturnType<typeof setTimeout> | null = null;
  private started = false;

  protected readonly title = computed(() => {
    const it = this.item.value();
    if (!it) return '';
    return it.Type === 'Episode' && it.SeriesName ? it.SeriesName : it.Name;
  });
  protected readonly subtitleLine = computed(() => {
    const it = this.item.value();
    if (!it || it.Type !== 'Episode') return null;
    const code = episodeCode(it);
    return code ? `${code} · ${it.Name}` : it.Name;
  });

  protected readonly audioTracks = computed(
    () => this.stream()?.mediaSource.MediaStreams?.filter((s) => s.Type === 'Audio') ?? [],
  );
  protected readonly subtitleTracks = computed(
    () =>
      this.stream()?.mediaSource.MediaStreams?.filter(
        (s) => s.Type === 'Subtitle' && (s.IsTextSubtitleStream || s.DeliveryMethod === 'External'),
      ) ?? [],
  );
  /** One-element array so @for recreates the <track> element on change. */
  protected readonly activeSubtitle = computed(() => {
    const stream = this.stream();
    const index = this.selectedSubtitle();
    if (!stream || index === null) return [];
    const track = this.subtitleTracks().find((s) => s.Index === index);
    if (!track) return [];
    return [
      {
        url: this.playbackApi.subtitleUrl(this.id(), stream.mediaSource.Id, index),
        label: track.DisplayTitle ?? track.Language ?? 'Subtitles',
      },
    ];
  });

  constructor() {
    // Start once the item metadata (for the resume position) is in.
    effect(() => {
      const it = this.item.value();
      if (it && !this.started) {
        this.started = true;
        untracked(() => void this.start(it));
      }
    });
    if (this.item.error()) this.error.set(true);

    this.destroyRef.onDestroy(() => this.teardown());
  }

  private async start(item: BaseItemDto, audioStreamIndex?: number, resumeAt?: number): Promise<void> {
    this.loading.set(true);
    this.error.set(false);
    try {
      const stream = await this.playItem.resolve(item.Id, { audioStreamIndex });
      this.stream.set(stream);
      this.selectedAudio.set(audioStreamIndex ?? stream.mediaSource.DefaultAudioStreamIndex);

      const video = this.videoRef().nativeElement;
      const startAt = resumeAt ?? ticksToSeconds(item.UserData?.PlaybackPositionTicks ?? 0);

      this.hls?.destroy();
      this.hls = null;

      if (stream.isHls && !video.canPlayType('application/vnd.apple.mpegurl')) {
        this.hls = new Hls();
        this.hls.loadSource(stream.url);
        this.hls.attachMedia(video);
        this.hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) this.error.set(true);
        });
      } else {
        video.src = stream.url;
      }

      if (startAt > 1) {
        video.addEventListener('loadedmetadata', () => (video.currentTime = startAt), { once: true });
      }

      await this.playbackApi.reportStart(this.report());
      this.progressTimer ??= setInterval(() => {
        if (this.playing()) void this.playbackApi.reportProgress(this.report());
      }, PROGRESS_INTERVAL_MS);
      this.pokeTimer();
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  private report() {
    const stream = this.stream()!;
    return {
      ItemId: this.id(),
      MediaSourceId: stream.mediaSource.Id,
      PlaySessionId: stream.playSessionId,
      PositionTicks: secondsToTicks(this.currentTime()),
      IsPaused: !this.playing(),
      PlayMethod: stream.method,
      AudioStreamIndex: this.selectedAudio(),
      CanSeek: true,
    };
  }

  private teardown(): void {
    if (this.progressTimer) clearInterval(this.progressTimer);
    if (this.controlsTimer) clearTimeout(this.controlsTimer);
    if (this.stream()) void this.playbackApi.reportStopped(this.report());
    this.hls?.destroy();
  }

  // --- controls ---

  protected togglePlay(): void {
    const video = this.videoRef().nativeElement;
    if (video.paused) void video.play();
    else video.pause();
  }

  protected onPlay(): void {
    this.playing.set(true);
    void this.playbackApi.reportProgress(this.report());
    this.pokeTimer();
  }

  protected onPause(): void {
    this.playing.set(false);
    this.controlsVisible.set(true);
    if (this.stream()) void this.playbackApi.reportProgress(this.report());
  }

  protected onEnded(): void {
    this.goBack();
  }

  protected onTimeUpdate(): void {
    const video = this.videoRef().nativeElement;
    this.currentTime.set(video.currentTime);
    if (Number.isFinite(video.duration)) this.duration.set(video.duration);
  }

  protected onVolumeChange(): void {
    this.volume.set(this.videoRef().nativeElement.volume);
  }

  protected onSeek(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.videoRef().nativeElement.currentTime = value;
    if (this.stream()) void this.playbackApi.reportProgress(this.report());
  }

  protected onVolume(event: Event): void {
    this.videoRef().nativeElement.volume = Number((event.target as HTMLInputElement).value);
  }

  protected onAudioChange(event: Event): void {
    const index = Number((event.target as HTMLSelectElement).value);
    const item = this.item.value();
    if (!item || index === this.selectedAudio()) return;
    // Audio switching restarts the stream (usually as a transcode) at the same spot.
    const position = this.currentTime();
    if (this.stream()) void this.playbackApi.reportStopped(this.report());
    void this.start(item, index, position);
  }

  protected onSubtitleChange(event: Event): void {
    const raw = (event.target as HTMLSelectElement).value;
    this.selectedSubtitle.set(raw === '' ? null : Number(raw));
  }

  protected toggleFullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void this.containerRef().nativeElement.requestFullscreen();
  }

  protected goBack(): void {
    this.location.back();
  }

  protected onKey(event: KeyboardEvent): void {
    if (event.target instanceof HTMLSelectElement || event.target instanceof HTMLInputElement) return;
    const video = this.videoRef().nativeElement;
    switch (event.key) {
      case ' ':
        event.preventDefault();
        this.togglePlay();
        break;
      case 'ArrowLeft':
        video.currentTime = Math.max(0, video.currentTime - 10);
        break;
      case 'ArrowRight':
        video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
        break;
      case 'f':
        this.toggleFullscreen();
        break;
      case 'm':
        video.muted = !video.muted;
        break;
    }
    this.poke();
  }

  protected poke(): void {
    this.controlsVisible.set(true);
    this.pokeTimer();
  }

  private pokeTimer(): void {
    if (this.controlsTimer) clearTimeout(this.controlsTimer);
    this.controlsTimer = setTimeout(() => {
      if (this.playing()) this.controlsVisible.set(false);
    }, CONTROLS_TIMEOUT_MS);
  }

  protected clock(seconds: number): string {
    return formatClock(seconds);
  }
}

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
  selector: 'jf-player-page',
  templateUrl: './player-page.html',
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

  private async start(
    item: BaseItemDto,
    audioStreamIndex?: number,
    resumeAt?: number,
  ): Promise<void> {
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
        video.addEventListener('loadedmetadata', () => (video.currentTime = startAt), {
          once: true,
        });
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
    if (event.target instanceof HTMLSelectElement || event.target instanceof HTMLInputElement)
      return;
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

import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { EpisodeNeighbors, PlaySession } from '@features/play-session';
import { PlaybackController } from '@features/playback-controller';
import { cardSubtitle } from '@entities/item';
import { BaseItemDto } from '@shared/api';
import { formatClock } from '@shared/lib/clock';
import { nextEpisodeHint } from '../model/next-episode-hint';
import { UpNextPolicy } from '../model/up-next-policy';
import { SeekBar } from './seek-bar';
import { UpNextCard } from './up-next-card';

const CONTROLS_TIMEOUT_MS = 3_000;

/**
 * Full-screen chrome over the Playback Stage's video: renders the session's
 * signals and forwards gestures as commands. It owns only chrome — controls
 * visibility, keyboard, the fullscreen request — never playback state. It
 * exists only while the player route is active, which is precisely what keeps
 * its document-level shortcuts out of the rest of the app.
 */
@Component({
  selector: 'jf-player-chrome',
  templateUrl: './player-chrome.html',
  imports: [SeekBar, UpNextCard],
  host: {
    '(document:keydown)': 'onKey($event)',
  },
})
export class PlayerChrome {
  readonly session = input.required<PlaySession>();
  readonly neighbors = input.required<EpisodeNeighbors>();
  readonly upNext = input.required<UpNextPolicy>();

  /** The stage owns the element browser fullscreen must target. */
  readonly fullscreenToggled = output<void>();

  private readonly playback = inject(PlaybackController);
  private readonly destroyRef = inject(DestroyRef);

  private readonly containerRef = viewChild.required<ElementRef<HTMLDivElement>>('container');

  protected readonly controlsVisible = signal(true);
  private controlsTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly isEpisode = computed(() => this.session().item()?.Type === 'Episode');
  protected readonly previousLabel = computed(() =>
    describeNeighbor('Previous episode', this.neighbors().previous()),
  );
  protected readonly nextLabel = computed(() =>
    describeNeighbor('Next episode', this.neighbors().next()),
  );
  protected readonly nextHint = computed(() => nextEpisodeHint(this.neighbors().next()));

  protected readonly title = computed(() => {
    const it = this.session().item();
    if (!it) return '';
    return it.Type === 'Episode' && it.SeriesName ? it.SeriesName : it.Name;
  });
  protected readonly subtitleLine = computed(() => {
    const it = this.session().item();
    if (!it || it.Type !== 'Episode') return null;
    return cardSubtitle(it);
  });

  constructor() {
    // Return focus to the player container when the Up Next card dismisses.
    let hadCard = false;
    effect(() => {
      const hasCard = this.upNext().state() !== null;
      if (hadCard && !hasCard) this.containerRef().nativeElement.focus();
      hadCard = hasCard;
    });
    this.destroyRef.onDestroy(() => {
      if (this.controlsTimer) clearTimeout(this.controlsTimer);
    });
  }

  // --- gestures forwarded as commands ---
  // Every deliberate gesture is also proof of life for the still-watching guard.

  protected togglePlay(): void {
    this.upNext().noteUserActivity();
    // The session is dead while the Up Next card is up; a stray Space or video
    // click must not restart the finished episode.
    if (this.upNext().state()) return;
    this.session().togglePlay();
  }

  protected onSeek(seconds: number): void {
    this.upNext().noteUserActivity();
    this.session().seek(seconds);
    this.poke();
  }

  protected onVolume(event: Event): void {
    this.upNext().noteUserActivity();
    this.session().setVolume(Number((event.target as HTMLInputElement).value));
  }

  protected onAudioChange(event: Event): void {
    this.upNext().noteUserActivity();
    this.session().selectAudio(Number((event.target as HTMLSelectElement).value));
  }

  protected onSubtitleChange(event: Event): void {
    this.upNext().noteUserActivity();
    const raw = (event.target as HTMLSelectElement).value;
    this.session().selectSubtitle(raw === '' ? null : Number(raw));
  }

  protected onQualityChange(event: Event): void {
    this.upNext().noteUserActivity();
    const raw = (event.target as HTMLSelectElement).value;
    this.session().selectQuality(raw === '' ? null : Number(raw));
  }

  /** Chrome-button hop: a deliberate gesture, unlike a policy auto-advance. */
  protected hopTo(target: BaseItemDto | undefined): void {
    this.upNext().noteUserActivity();
    if (target) this.playback.play(target.Id);
  }

  // --- host chrome ---

  protected toggleFullscreen(): void {
    this.upNext().noteUserActivity();
    this.fullscreenToggled.emit();
  }

  /** Leave the player route; playback continues in the dock. */
  protected minimize(): void {
    this.playback.dock();
  }

  /** End playback outright. */
  protected close(): void {
    this.playback.close();
  }

  protected onKey(event: KeyboardEvent): void {
    if (event.target instanceof HTMLSelectElement || event.target instanceof HTMLInputElement)
      return;
    let handled = true;
    const session = this.session();
    switch (event.key) {
      case ' ':
        event.preventDefault();
        this.togglePlay();
        break;
      case 'Escape':
        this.upNext().cancel();
        break;
      case 'ArrowLeft':
        session.seek(Math.max(0, session.position() - 10));
        break;
      case 'ArrowRight':
        session.seek(Math.min(session.duration() || Infinity, session.position() + 10));
        break;
      case 'f':
        this.toggleFullscreen();
        break;
      case 'm':
        session.toggleMute();
        break;
      case 'N':
        if (event.shiftKey) this.hopTo(this.neighbors().next());
        break;
      case 'P':
        if (event.shiftKey) this.hopTo(this.neighbors().previous());
        break;
      default:
        handled = false;
    }
    if (handled) this.upNext().noteUserActivity();
    this.poke();
  }

  protected poke(): void {
    this.controlsVisible.set(true);
    this.pokeTimer();
  }

  private pokeTimer(): void {
    if (this.controlsTimer) clearTimeout(this.controlsTimer);
    this.controlsTimer = setTimeout(() => {
      if (this.session().playing()) this.controlsVisible.set(false);
    }, CONTROLS_TIMEOUT_MS);
  }

  protected clock(seconds: number): string {
    return formatClock(seconds);
  }
}

/** "Next episode: S2:E6 · Title", or just the prefix while no target exists. */
function describeNeighbor(prefix: string, target: BaseItemDto | undefined): string {
  if (!target) return prefix;
  return `${prefix}: ${cardSubtitle(target) ?? target.Name}`;
}

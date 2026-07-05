import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { createEpisodeNeighbors, createPlaySession } from '@features/play-session';
import { episodeCode } from '@entities/item';
import { BaseItemDto } from '@shared/api';
import { formatClock } from '@shared/lib/clock';
import { createUpNextPolicy } from '../model/up-next-policy';
import { UpNextCard } from './up-next-card';

const CONTROLS_TIMEOUT_MS = 3_000;

/**
 * Thin host for a Play Session: renders the module's signals and forwards user
 * gestures as commands. It owns only chrome — controls visibility, fullscreen,
 * keyboard, and the ended-navigates-back policy — never playback state.
 */
@Component({
  selector: 'jf-player-page',
  templateUrl: './player-page.html',
  imports: [UpNextCard],
  host: {
    '(document:keydown)': 'onKey($event)',
  },
})
export class PlayerPage {
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Route param via withComponentInputBinding. */
  readonly id = input.required<string>();

  private readonly videoRef = viewChild<ElementRef<HTMLVideoElement>>('video');
  private readonly containerRef = viewChild.required<ElementRef<HTMLDivElement>>('container');

  protected readonly session = createPlaySession(
    () => this.id(),
    () => this.videoRef()?.nativeElement ?? null,
  );

  protected readonly neighbors = createEpisodeNeighbors(() => this.session.item());

  /** Ending policy: Up Next countdown for episodes, exit-as-before otherwise. */
  protected readonly upNext = createUpNextPolicy({
    ended: () => this.session.ended(),
    item: () => this.session.item(),
    next: () => this.neighbors.next(),
    neighborsLoading: () => this.neighbors.loading(),
    advance: (episode) => this.toNeighbor(episode),
    exit: () => this.goBack(),
  });

  protected readonly controlsVisible = signal(true);
  private controlsTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly isEpisode = computed(() => this.session.item()?.Type === 'Episode');
  protected readonly previousLabel = computed(() =>
    describeNeighbor('Previous episode', this.neighbors.previous()),
  );
  protected readonly nextLabel = computed(() =>
    describeNeighbor('Next episode', this.neighbors.next()),
  );

  protected readonly title = computed(() => {
    const it = this.session.item();
    if (!it) return '';
    return it.Type === 'Episode' && it.SeriesName ? it.SeriesName : it.Name;
  });
  protected readonly subtitleLine = computed(() => {
    const it = this.session.item();
    if (!it || it.Type !== 'Episode') return null;
    const code = episodeCode(it);
    return code ? `${code} · ${it.Name}` : it.Name;
  });

  constructor() {
    // Return focus to the player container when the Up Next card dismisses.
    let hadCard = false;
    effect(() => {
      const hasCard = this.upNext.state() !== null;
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
    this.upNext.noteUserActivity();
    // The session is dead while the Up Next card is up; a stray Space or video
    // click must not restart the finished episode.
    if (this.upNext.state()) return;
    this.session.togglePlay();
  }

  protected onSeek(event: Event): void {
    this.upNext.noteUserActivity();
    this.session.seek(Number((event.target as HTMLInputElement).value));
  }

  protected onVolume(event: Event): void {
    this.upNext.noteUserActivity();
    this.session.setVolume(Number((event.target as HTMLInputElement).value));
  }

  protected onAudioChange(event: Event): void {
    this.upNext.noteUserActivity();
    this.session.selectAudio(Number((event.target as HTMLSelectElement).value));
  }

  protected onSubtitleChange(event: Event): void {
    this.upNext.noteUserActivity();
    const raw = (event.target as HTMLSelectElement).value;
    this.session.selectSubtitle(raw === '' ? null : Number(raw));
  }

  /**
   * Episode-to-episode hops replace the history entry so browser Back always
   * exits the player to the page it was opened from.
   */
  protected toNeighbor(target: BaseItemDto | undefined): void {
    // Also the Up Next policy's advance path — must NOT count as user
    // activity, or every auto-advance would reset the still-watching guard.
    if (!target) return;
    void this.router.navigate(['/player', target.Id], { replaceUrl: true });
  }

  /** Chrome-button hop: a deliberate gesture, unlike a policy auto-advance. */
  protected hopTo(target: BaseItemDto | undefined): void {
    this.upNext.noteUserActivity();
    this.toNeighbor(target);
  }

  // --- host chrome ---

  protected toggleFullscreen(): void {
    this.upNext.noteUserActivity();
    if (document.fullscreenElement) void document.exitFullscreen();
    else void this.containerRef().nativeElement.requestFullscreen();
  }

  protected goBack(): void {
    this.location.back();
  }

  protected onKey(event: KeyboardEvent): void {
    if (event.target instanceof HTMLSelectElement || event.target instanceof HTMLInputElement)
      return;
    let handled = true;
    switch (event.key) {
      case ' ':
        event.preventDefault();
        this.togglePlay();
        break;
      case 'Escape':
        this.upNext.cancel();
        break;
      case 'ArrowLeft':
        this.session.seek(Math.max(0, this.session.position() - 10));
        break;
      case 'ArrowRight':
        this.session.seek(Math.min(this.session.duration() || Infinity, this.session.position() + 10));
        break;
      case 'f':
        this.toggleFullscreen();
        break;
      case 'm':
        this.session.toggleMute();
        break;
      case 'N':
        if (event.shiftKey) this.toNeighbor(this.neighbors.next());
        break;
      case 'P':
        if (event.shiftKey) this.toNeighbor(this.neighbors.previous());
        break;
      default:
        handled = false;
    }
    if (handled) this.upNext.noteUserActivity();
    this.poke();
  }

  protected poke(): void {
    this.controlsVisible.set(true);
    this.pokeTimer();
  }

  private pokeTimer(): void {
    if (this.controlsTimer) clearTimeout(this.controlsTimer);
    this.controlsTimer = setTimeout(() => {
      if (this.session.playing()) this.controlsVisible.set(false);
    }, CONTROLS_TIMEOUT_MS);
  }

  protected clock(seconds: number): string {
    return formatClock(seconds);
  }
}

/** "Next episode: S2:E6 · Title", or just the prefix while no target exists. */
function describeNeighbor(prefix: string, target: BaseItemDto | undefined): string {
  if (!target) return prefix;
  const code = episodeCode(target);
  return code ? `${prefix}: ${code} · ${target.Name}` : `${prefix}: ${target.Name}`;
}

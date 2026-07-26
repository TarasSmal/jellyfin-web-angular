import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { createEpisodeNeighbors, createPlaySession } from '@features/play-session';
import { PlaybackController } from '@features/playback-controller';
import { BaseItemDto } from '@shared/api';
import { createArtworkWarmup } from '../model/artwork-warmup';
import { createUpNextPolicy } from '../model/up-next-policy';
import { MiniPlayer } from './mini-player';
import { PlayerChrome } from './player-chrome';

/** Full screen sits above everything; the dock sits under the app header. */
const FULLSCREEN_CLASS = 'fixed inset-0 z-50 bg-black';
const DOCKED_CLASS =
  'fixed bottom-3 right-3 z-40 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-border bg-black shadow-2xl';

/**
 * Hosts one playback attempt: it owns the single `<video>` element and the
 * Play Session bound to it, and swaps only the *chrome* around them when the
 * presentation changes. The video element is declared outside every `@if`, so
 * switching between full screen and the dock cannot re-create it — which is
 * the whole trick: a re-created media element would restart the stream and
 * open a second server session.
 */
@Component({
  selector: 'jf-playback-stage',
  imports: [PlayerChrome, MiniPlayer],
  templateUrl: './playback-stage.html',
})
export class PlaybackStage {
  /** The item to play; changing it rotates the session (ADR 0004). */
  readonly itemId = input.required<string>();

  private readonly playback = inject(PlaybackController);
  private readonly destroyRef = inject(DestroyRef);

  private readonly videoRef = viewChild<ElementRef<HTMLVideoElement>>('video');
  private readonly stageRef = viewChild.required<ElementRef<HTMLDivElement>>('stage');

  protected readonly session = createPlaySession(
    () => this.itemId(),
    () => this.videoRef()?.nativeElement ?? null,
  );

  protected readonly neighbors = createEpisodeNeighbors(() => this.session.item());

  /** Ending policy is the host's (ADR 0004); one instance across both chromes,
   * so a countdown and the still-watching guard survive expand/collapse. */
  protected readonly upNext = createUpNextPolicy({
    ended: () => this.session.ended(),
    item: () => this.session.item(),
    next: () => this.neighbors.next(),
    neighborsLoading: () => this.neighbors.loading(),
    advance: (episode) => this.toNeighbor(episode),
    exit: () => this.playback.close(),
  });

  protected readonly fullscreen = computed(() => this.playback.presentation() === 'fullscreen');
  protected readonly stageClass = computed(() =>
    this.fullscreen() ? FULLSCREEN_CLASS : DOCKED_CLASS,
  );

  constructor() {
    // The Up Next card's artwork is already cached by the time the card shows.
    createArtworkWarmup(() => this.neighbors.next());

    this.playback.hostSession(this.session);
    this.destroyRef.onDestroy(() => this.playback.releaseSession(this.session));

    // Browser fullscreen cannot survive the shrink — a docked element filling
    // the screen would trap the viewer on a corner player.
    effect(() => {
      if (!this.fullscreen() && document.fullscreenElement) void document.exitFullscreen();
    });
  }

  /** Episode-to-episode hop: rotate the hosted item (the controller keeps a
   * full-screen player's URL in step). */
  protected toNeighbor(target: BaseItemDto | undefined): void {
    if (target) this.playback.play(target.Id);
  }

  /** Full screen: the video is the play/pause surface. Docked: it expands. */
  protected onVideoClick(): void {
    if (!this.fullscreen()) {
      this.playback.expand();
      return;
    }
    this.upNext.noteUserActivity();
    // The session is dead while the Up Next card is up; a stray click must not
    // restart the finished episode.
    if (this.upNext.state()) return;
    this.session.togglePlay();
  }

  protected requestFullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void this.stageRef().nativeElement.requestFullscreen();
  }
}

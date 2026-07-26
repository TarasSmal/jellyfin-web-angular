import { Location } from '@angular/common';
import { Service, Signal, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

/** How the hosted playback is currently shown. */
export type Presentation = 'fullscreen' | 'docked';

/**
 * All this slice needs of a Play Session. Structural on purpose: the
 * controller is imported by the app root, so it must not pull the playback
 * module (and hls.js with it) into the initial bundle.
 */
export interface StoppablePlayback {
  stop(): void;
}

const PLAYER_PATH = '/player';

/**
 * What is playing, and the intent commands for it. The Play Session itself is
 * owned by whichever component hosts the video surface (the Playback Stage);
 * this holds only the item and the presentation, so a page can ask for
 * playback without knowing where the video lives.
 *
 * Presentation is *derived* from the URL rather than stored: the player route
 * means full screen, everything else means docked. One source of truth, so
 * browser Back and Forward move the player without any bookkeeping.
 */
@Service()
export class PlaybackController {
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  private readonly _itemId = signal<string | null>(null);
  readonly itemId = this._itemId.asReadonly();
  readonly active = computed(() => this._itemId() !== null);

  /** The stage registers its session here so `close()` can stop it in time. */
  private session: StoppablePlayback | null = null;

  private readonly url = computed(() => {
    // currentNavigation flips at RoutesRecognized, so the player starts
    // shrinking as the router commits; it falls back to the last completed
    // navigation once that one finishes (or is abandoned).
    const navigation = this.router.currentNavigation() ?? this.router.lastSuccessfulNavigation();
    const target = navigation?.finalUrl;
    return target ? this.router.serializeUrl(target) : this.router.url;
  });

  readonly presentation: Signal<Presentation> = computed(() =>
    this.url().startsWith(PLAYER_PATH) ? 'fullscreen' : 'docked',
  );

  /**
   * Host playback of `itemId`. Idempotent for the item already playing — that
   * is what makes pressing Play on the docked item expand the live session
   * instead of restarting it at the last reported position.
   */
  play(itemId: string): void {
    if (this._itemId() === itemId) return;
    this._itemId.set(itemId);
    // A full-screen player's URL follows the item now playing, but *replaces*
    // its history entry: Back must exit the player, not step back through a
    // binge. Docked playback owns no URL, so there is nothing to sync.
    if (this.presentation() === 'fullscreen' && this.url() !== `${PLAYER_PATH}/${itemId}`) {
      void this.router.navigate([PLAYER_PATH, itemId], { replaceUrl: true });
    }
  }

  /** Back to the player route; a push, so browser Back re-docks it. */
  expand(): void {
    const itemId = this._itemId();
    if (itemId) void this.router.navigate([PLAYER_PATH, itemId]);
  }

  /** Leave the player route, keeping playback alive in the dock. */
  dock(): void {
    if (this.presentation() === 'docked') return;
    this.leavePlayerRoute();
  }

  /**
   * End playback. Stops the session *synchronously* so its Stopped report goes
   * out while the access token is still valid — deferring to the stage's
   * teardown would lose that race on sign-out.
   */
  close(): void {
    const itemId = this._itemId();
    this.session?.stop();
    this.session = null;
    this._itemId.set(null);
    if (this.presentation() === 'fullscreen') this.leavePlayerRoute(itemId);
  }

  /** Called by the stage that owns the video surface; released on its destroy. */
  hostSession(session: StoppablePlayback): void {
    this.session = session;
  }

  releaseSession(session: StoppablePlayback): void {
    if (this.session === session) this.session = null;
  }

  /**
   * A deep-linked player has no in-app history, so Back would leave the site;
   * fall back to the item's detail page.
   */
  private leavePlayerRoute(itemId = this._itemId()): void {
    if (this.router.lastSuccessfulNavigation()?.previousNavigation) this.location.back();
    else void this.router.navigate(itemId ? ['/item', itemId] : ['/']);
  }
}

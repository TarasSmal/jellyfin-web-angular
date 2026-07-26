import { Component, effect, inject, input } from '@angular/core';
import { PlaybackController } from '@features/playback-controller';

/**
 * Intent-only route: this URL means "play this item, full screen". The video,
 * the Play Session and all chrome live in the Playback Stage at the app root,
 * so leaving this route docks playback instead of ending it — hence no
 * teardown hook here.
 */
@Component({
  selector: 'jf-player-page',
  templateUrl: './player-page.html',
})
export class PlayerPage {
  /** Route param via withComponentInputBinding. */
  readonly id = input.required<string>();

  private readonly playback = inject(PlaybackController);

  constructor() {
    effect(() => this.playback.play(this.id()));
  }
}

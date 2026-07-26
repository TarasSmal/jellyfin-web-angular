import { Component, inject } from '@angular/core';
import { PlaybackController } from '@features/playback-controller';
import { PlaybackStage } from './playback-stage';

/**
 * Mounted once at the app root, outside the router outlet — that is what lets
 * playback outlive a route change. It renders a stage per playback attempt;
 * rotating to another item keeps the same stage (and the same video element).
 */
@Component({
  selector: 'jf-playback-outlet',
  imports: [PlaybackStage],
  templateUrl: './playback-outlet.html',
})
export class PlaybackOutlet {
  protected readonly playback = inject(PlaybackController);
}

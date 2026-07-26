import { Component, computed, inject, input } from '@angular/core';
import { PlaySession } from '@features/play-session';
import { PlaybackController } from '@features/playback-controller';
import { cardSubtitle } from '@entities/item';

/**
 * Docked chrome over the stage's video. Deliberately minimal: the video itself
 * is the expand surface, so this adds only what a corner player needs and no
 * document-level shortcuts — those stay a full-screen privilege, or Space
 * would pause playback while the viewer types in the header's search box.
 */
@Component({
  selector: 'jf-mini-player',
  templateUrl: './mini-player.html',
})
export class MiniPlayer {
  readonly session = input.required<PlaySession>();

  private readonly playback = inject(PlaybackController);

  protected readonly title = computed(() => {
    const item = this.session().item();
    if (!item) return '';
    return item.Type === 'Episode' && item.SeriesName ? item.SeriesName : item.Name;
  });

  protected readonly subtitleLine = computed(() => {
    const item = this.session().item();
    return item?.Type === 'Episode' ? cardSubtitle(item) : null;
  });

  protected expand(): void {
    this.playback.expand();
  }

  protected close(): void {
    this.playback.close();
  }
}

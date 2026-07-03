import { Component, computed, input, output } from '@angular/core';
import { SessionInfo } from '@shared/api';
import { formatClock } from '@shared/lib/clock';
import { ticksToSeconds } from '@shared/lib/ticks';

const PLAY_METHOD_LABELS: Record<string, string> = {
  Transcode: 'Transcoding',
  DirectStream: 'Direct Stream',
  DirectPlay: 'Direct Play',
};

/** One connected device: what it's playing (with progress) or that it's idle. */
@Component({
  selector: 'jf-session-card',
  templateUrl: './session-card.html',
})
export class SessionCard {
  readonly session = input.required<SessionInfo>();
  /** Resolved by the caller (image URL building lives with the item entity). */
  readonly posterUrl = input<string | null>(null);
  /** Show remote-control actions (admin contexts only). */
  readonly controls = input(false);
  readonly messageRequested = output<void>();
  readonly stopRequested = output<void>();

  protected readonly title = computed(() => {
    const item = this.session().NowPlayingItem;
    if (!item) return '';
    return item.SeriesName ? `${item.SeriesName} · ${item.Name}` : item.Name;
  });

  protected readonly playMethod = computed(() => {
    const method = this.session().PlayState?.PlayMethod;
    return method ? (PLAY_METHOD_LABELS[method] ?? method) : null;
  });

  protected readonly progress = computed<number | null>(() => {
    const position = this.session().PlayState?.PositionTicks;
    const runtime = this.session().NowPlayingItem?.RunTimeTicks;
    if (!position || !runtime) return null;
    return Math.min(100, (position / runtime) * 100);
  });

  protected readonly progressRounded = computed(() => {
    const value = this.progress();
    return value === null ? null : Math.round(value);
  });

  protected readonly positionLabel = computed(() => {
    const position = this.session().PlayState?.PositionTicks;
    const runtime = this.session().NowPlayingItem?.RunTimeTicks;
    if (!position || !runtime) return null;
    return `${formatClock(ticksToSeconds(position))} / ${formatClock(ticksToSeconds(runtime))}`;
  });
}

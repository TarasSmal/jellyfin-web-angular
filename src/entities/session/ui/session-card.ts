import { Component, computed, input } from '@angular/core';
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
  selector: 'app-session-card',
  template: `
    <article class="flex gap-3 rounded-xl border border-border bg-surface p-3">
      @if (posterUrl(); as url) {
        <img [src]="url" alt="" class="h-20 w-14 shrink-0 rounded-md object-cover" />
      }
      <div class="min-w-0 flex-1 self-center">
        @if (session().NowPlayingItem) {
          <p class="truncate font-medium">{{ title() }}</p>
          <p class="truncate text-sm text-text-muted">
            {{ session().UserName }} · {{ session().DeviceName }}
          </p>
          <p class="mt-0.5 truncate text-xs text-text-muted">
            {{ session().PlayState?.IsPaused ? 'Paused' : 'Playing' }}
            @if (playMethod(); as method) {
              · {{ method }}
            }
            @if (positionLabel(); as position) {
              · {{ position }}
            }
          </p>
          @if (progress() !== null) {
            <div
              class="mt-2 h-1 overflow-hidden rounded-full bg-surface-raised"
              role="progressbar"
              aria-label="Playback progress"
              [attr.aria-valuenow]="progressRounded()"
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <div class="h-full rounded-full bg-accent" [style.width.%]="progress()"></div>
            </div>
          }
        } @else {
          <p class="truncate font-medium">{{ session().UserName || 'Unknown user' }}</p>
          <p class="truncate text-sm text-text-muted">
            {{ session().Client }} · {{ session().DeviceName }}
          </p>
        }
      </div>
    </article>
  `,
})
export class SessionCard {
  readonly session = input.required<SessionInfo>();
  /** Resolved by the caller (image URL building lives with the item entity). */
  readonly posterUrl = input<string | null>(null);

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

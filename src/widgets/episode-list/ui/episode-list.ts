import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiConfig, BaseItemDto } from '@shared/api';
import { itemThumbUrl } from '@entities/item';
import { formatRuntime } from '@shared/lib/ticks';

@Component({
  selector: 'app-episode-list',
  imports: [RouterLink],
  template: `
    <div class="space-y-2">
      @if (loading()) {
        @for (i of skeletons; track i) {
          <div class="h-24 animate-pulse rounded-lg bg-surface"></div>
        }
      }
      @for (episode of episodes(); track episode.Id) {
        <a
          [routerLink]="['/player', episode.Id]"
          class="group flex gap-4 rounded-lg p-2 transition-colors hover:bg-surface"
        >
          <div class="relative w-40 shrink-0 overflow-hidden rounded-md bg-surface-raised aspect-backdrop md:w-48">
            @if (thumb(episode); as url) {
              <img [src]="url" [alt]="episode.Name" loading="lazy" class="h-full w-full object-cover" />
            }
            @if (progress(episode); as pct) {
              <div class="absolute inset-x-0 bottom-0 h-1 bg-black/50">
                <div class="h-full bg-accent" [style.width.%]="pct"></div>
              </div>
            }
          </div>
          <div class="min-w-0 flex-1 py-1">
            <p class="flex items-baseline gap-2 font-medium">
              <span class="text-text-faint">{{ episode.IndexNumber }}.</span>
              <span class="truncate">{{ episode.Name }}</span>
              @if (episode.UserData?.Played) {
                <svg class="h-4 w-4 shrink-0 self-center text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              }
            </p>
            @if (episode.RunTimeTicks; as ticks) {
              <p class="text-xs text-text-faint">{{ runtime(ticks) }}</p>
            }
            @if (episode.Overview; as overview) {
              <p class="mt-1 line-clamp-2 text-sm text-text-muted">{{ overview }}</p>
            }
          </div>
        </a>
      }
    </div>
  `,
})
export class EpisodeList {
  private readonly config = inject(ApiConfig);

  readonly episodes = input<BaseItemDto[] | undefined>(undefined);
  readonly loading = input(false);

  protected readonly skeletons = Array.from({ length: 6 }, (_, i) => i);

  protected thumb(episode: BaseItemDto): string | null {
    return itemThumbUrl(this.config, episode, 400);
  }

  protected runtime(ticks: number): string {
    return formatRuntime(ticks);
  }

  protected progress(episode: BaseItemDto): number | null {
    const pct = episode.UserData?.PlayedPercentage;
    return pct && pct > 0 && pct < 100 ? pct : null;
  }
}

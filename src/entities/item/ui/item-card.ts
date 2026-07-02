import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiConfig, BaseItemDto } from '@shared/api';
import { itemPosterUrl, itemThumbUrl } from '../lib/item-images';
import { cardSubtitle, cardTitle } from '../lib/item-labels';

@Component({
  selector: 'app-item-card',
  imports: [RouterLink],
  template: `
    <a
      [routerLink]="['/item', linkId()]"
      class="group block shrink-0 snap-start"
      [class.w-full]="fluid()"
      [class.w-36]="!fluid() && shape() === 'poster'"
      [class.md:w-44]="!fluid() && shape() === 'poster'"
      [class.w-64]="!fluid() && shape() === 'thumb'"
      [class.md:w-72]="!fluid() && shape() === 'thumb'"
    >
      <div
        class="relative overflow-hidden rounded-lg bg-surface ring-accent transition group-hover:ring-2"
        [class.aspect-poster]="shape() === 'poster'"
        [class.aspect-backdrop]="shape() === 'thumb'"
      >
        @if (imageUrl(); as url) {
          <img
            [src]="url"
            [alt]="title()"
            loading="lazy"
            class="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        } @else {
          <div class="flex h-full w-full items-center justify-center p-2 text-center text-sm text-text-faint">
            {{ title() }}
          </div>
        }
        @if (progress(); as pct) {
          <div class="absolute inset-x-0 bottom-0 h-1 bg-black/50">
            <div class="h-full bg-accent" [style.width.%]="pct"></div>
          </div>
        }
      </div>
      <p class="mt-2 truncate text-sm font-medium">{{ title() }}</p>
      @if (subtitle(); as sub) {
        <p class="truncate text-xs text-text-muted">{{ sub }}</p>
      }
    </a>
  `,
})
export class ItemCard {
  private readonly config = inject(ApiConfig);

  readonly item = input.required<BaseItemDto>();
  readonly shape = input<'poster' | 'thumb'>('poster');
  /** Fill the parent cell (grid layouts) instead of fixed rail widths. */
  readonly fluid = input(false);

  protected readonly title = computed(() => cardTitle(this.item()));
  protected readonly subtitle = computed(() => cardSubtitle(this.item()));
  protected readonly progress = computed(() => {
    const pct = this.item().UserData?.PlayedPercentage;
    return pct && pct > 0 && pct < 100 ? pct : null;
  });

  /** Episodes and seasons navigate to their series page; everything else to itself. */
  protected readonly linkId = computed(() => {
    const item = this.item();
    const isChildOfSeries = item.Type === 'Episode' || item.Type === 'Season';
    return isChildOfSeries && item.SeriesId ? item.SeriesId : item.Id;
  });

  protected readonly imageUrl = computed(() =>
    this.shape() === 'poster'
      ? itemPosterUrl(this.config, this.item())
      : itemThumbUrl(this.config, this.item()),
  );
}

import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiConfig, BaseItemDto } from '@shared/api';
import { itemPosterUrl, itemThumbUrl, studioImageUrl } from '../lib/item-images';
import { cardMeta, cardTitle, studioName } from '../lib/item-labels';

@Component({
  selector: 'jf-item-card',
  imports: [RouterLink],
  templateUrl: './item-card.html',
})
export class ItemCard {
  private readonly config = inject(ApiConfig);

  readonly item = input.required<BaseItemDto>();
  readonly shape = input<'poster' | 'thumb'>('poster');
  /** Fill the parent cell (grid layouts) instead of fixed rail widths. */
  readonly fluid = input(false);

  protected readonly title = computed(() => cardTitle(this.item()));
  protected readonly meta = computed(() => cardMeta(this.item()));
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

  protected readonly studioLogoUrl = computed(() => {
    const name = studioName(this.item());
    return name ? studioImageUrl(this.config, name) : null;
  });

  /** Hides the badge when the server has no logo; resets when the item changes. */
  protected readonly studioLogoFailed = linkedSignal({
    source: this.studioLogoUrl,
    computation: () => false,
  });
}

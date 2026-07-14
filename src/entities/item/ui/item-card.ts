import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiConfig, BaseItemDto } from '@shared/api';
import { BlurImg } from '@shared/ui/blur-img';
import {
  itemPosterHash,
  itemPosterSrcset,
  itemPosterUrl,
  itemThumbHash,
  itemThumbSrcset,
  itemThumbUrl,
  studioImageUrl,
} from '../lib/item-images';
import { cardMeta, cardTitle, studioName } from '../lib/item-labels';

@Component({
  selector: 'jf-item-card',
  imports: [RouterLink, BlurImg],
  templateUrl: './item-card.html',
})
export class ItemCard {
  private readonly config = inject(ApiConfig);

  readonly item = input.required<BaseItemDto>();
  readonly shape = input<'poster' | 'thumb'>('poster');
  /** Fill the parent cell (grid layouts) instead of fixed rail widths. */
  readonly fluid = input(false);
  /** Where the card navigates: the item's detail page, or straight into playback. */
  readonly linkTarget = input<'detail' | 'player'>('detail');

  protected readonly title = computed(() => cardTitle(this.item()));
  protected readonly meta = computed(() => cardMeta(this.item()));
  protected readonly progress = computed(() => {
    const pct = this.item().UserData?.PlayedPercentage;
    return pct && pct > 0 && pct < 100 ? pct : null;
  });

  /**
   * Detail links send episodes and seasons to their series page; play links
   * always target the item itself.
   */
  protected readonly link = computed(() => {
    const item = this.item();
    if (this.linkTarget() === 'player') return ['/player', item.Id];
    const isChildOfSeries = item.Type === 'Episode' || item.Type === 'Season';
    return ['/item', isChildOfSeries && item.SeriesId ? item.SeriesId : item.Id];
  });

  /** Play targets announce the action; detail targets let the card text speak. */
  protected readonly ariaLabel = computed(() => {
    if (this.linkTarget() !== 'player') return null;
    const meta = this.meta();
    return `Play ${this.title()}${meta ? ` — ${meta}` : ''}`;
  });

  protected readonly imageUrl = computed(() =>
    this.shape() === 'poster'
      ? itemPosterUrl(this.config, this.item())
      : itemThumbUrl(this.config, this.item()),
  );

  protected readonly imageHash = computed(() =>
    this.shape() === 'poster' ? itemPosterHash(this.item()) : itemThumbHash(this.item()),
  );

  protected readonly imageSrcset = computed(() =>
    this.shape() === 'poster'
      ? itemPosterSrcset(this.config, this.item())
      : itemThumbSrcset(this.config, this.item()),
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

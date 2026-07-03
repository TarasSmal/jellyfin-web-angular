import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import {
  ApiConfig,
  BaseItemDto,
  ItemsResult,
  episodesRequest,
  itemRequest,
  seasonsRequest,
} from '@shared/api';
import { itemBackdropUrl, itemPosterUrl, personImageUrl } from '@entities/item';
import { FavoriteButton } from '@features/toggle-favorite';
import { WatchedButton } from '@features/mark-watched';
import { EpisodeList } from '@widgets/episode-list';
import { formatRuntime } from '@shared/lib/ticks';

@Component({
  selector: 'jf-item-page',
  imports: [RouterLink, FavoriteButton, WatchedButton, EpisodeList],
  templateUrl: './item-page.html',
})
export class ItemPage {
  private readonly config = inject(ApiConfig);

  /** Route param via withComponentInputBinding. */
  readonly id = input.required<string>();

  protected readonly item = httpResource<BaseItemDto>(() => itemRequest(this.config, this.id()));

  protected readonly seasons = httpResource<ItemsResult>(() => {
    const it = this.item.value();
    return it?.Type === 'Series' ? seasonsRequest(this.config, it.Id) : undefined;
  });

  protected readonly selectedSeasonId = linkedSignal(() => this.seasons.value()?.Items[0]?.Id);

  protected readonly episodes = httpResource<ItemsResult>(() => {
    const it = this.item.value();
    const seasonId = this.selectedSeasonId();
    return it?.Type === 'Series' && seasonId
      ? episodesRequest(this.config, it.Id, seasonId)
      : undefined;
  });

  protected readonly backdrop = computed(() => {
    const it = this.item.value();
    return it ? itemBackdropUrl(this.config, it) : null;
  });
  protected readonly poster = computed(() => {
    const it = this.item.value();
    return it ? itemPosterUrl(this.config, it, 660) : null;
  });
  protected readonly cast = computed(
    () =>
      this.item
        .value()
        ?.People?.filter((p) => p.Type === 'Actor')
        .slice(0, 20) ?? [],
  );
  protected readonly resumeLabel = computed(() => {
    const position = this.item.value()?.UserData?.PlaybackPositionTicks ?? 0;
    return position > 0 ? 'Resume' : 'Play';
  });

  protected onSeason(event: Event): void {
    this.selectedSeasonId.set((event.target as HTMLSelectElement).value);
  }

  protected runtime(ticks: number): string {
    return formatRuntime(ticks);
  }

  protected personImage(person: { Id: string; PrimaryImageTag?: string }): string | null {
    return personImageUrl(this.config, person);
  }
}

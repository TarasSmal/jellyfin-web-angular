import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
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
import {
  itemBackdropHash,
  itemBackdropSrcset,
  itemBackdropUrl,
  itemLogoUrl,
  personImageUrl,
} from '@entities/item';
import { FavoriteButton } from '@features/toggle-favorite';
import { WatchedButton } from '@features/mark-watched';
import { EpisodeList } from '@widgets/episode-list';
import { BlurImg } from '@shared/ui/blur-img';
import { formatRuntime } from '@shared/lib/ticks';

@Component({
  selector: 'jf-item-page',
  imports: [RouterLink, FavoriteButton, WatchedButton, EpisodeList, BlurImg],
  templateUrl: './item-page.html',
})
export class ItemPage {
  private readonly config = inject(ApiConfig);
  private readonly document = inject(DOCUMENT);

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
  protected readonly backdropHash = computed(() => {
    const it = this.item.value();
    return it ? itemBackdropHash(it) : null;
  });
  protected readonly backdropSrcset = computed(() => {
    const it = this.item.value();
    return it ? itemBackdropSrcset(this.config, it) : null;
  });
  protected readonly logo = computed(() => {
    const it = this.item.value();
    return it ? itemLogoUrl(this.config, it) : null;
  });
  protected readonly cast = computed(
    () =>
      this.item
        .value()
        ?.People?.filter((p) => p.Type === 'Actor')
        .slice(0, 20) ?? [],
  );
  /** "Starring Ed O'Neill, Julie Bowen, …" — the top-billed names for the hero. */
  protected readonly starring = computed(() => {
    const names = this.cast()
      .slice(0, 6)
      .map((p) => p.Name);
    return names.length ? names.join(', ') : null;
  });
  protected readonly seasonsLabel = computed(() => {
    const count = this.seasons.value()?.TotalRecordCount;
    if (!count) return null;
    return count === 1 ? '1 Season' : `${count} Seasons`;
  });
  protected readonly resumeLabel = computed(() => {
    const position = this.item.value()?.UserData?.PlaybackPositionTicks ?? 0;
    return position > 0 ? 'Resume' : 'Play';
  });

  protected onSeason(event: Event): void {
    this.selectedSeasonId.set((event.target as HTMLSelectElement).value);
  }

  protected scrollTo(sectionId: string): void {
    this.document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
  }

  protected runtime(ticks: number): string {
    return formatRuntime(ticks);
  }

  protected personImage(person: { Id: string; PrimaryImageTag?: string }): string | null {
    return personImageUrl(this.config, person);
  }
}

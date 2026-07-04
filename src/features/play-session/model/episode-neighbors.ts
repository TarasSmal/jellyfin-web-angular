import { Signal, computed, inject } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { ApiConfig, BaseItemDto, ItemsResult, adjacentEpisodesRequest } from '@shared/api';

/**
 * Episode Neighbors: the previous/next episode of the hosted item in series
 * play order (across season boundaries). Inert for movies and undefined items.
 */
export interface EpisodeNeighbors {
  readonly previous: Signal<BaseItemDto | undefined>;
  readonly next: Signal<BaseItemDto | undefined>;
  readonly loading: Signal<boolean>;
}

/**
 * Create Episode Neighbors bound to a reactive item (typically a Play
 * Session's `item` signal). Must be called in an injection context.
 */
export function createEpisodeNeighbors(item: () => BaseItemDto | undefined): EpisodeNeighbors {
  const config = inject(ApiConfig);

  const resource = httpResource<ItemsResult>(() => {
    const current = item();
    if (!current || current.Type !== 'Episode' || !current.SeriesId) return undefined;
    return adjacentEpisodesRequest(config, current.SeriesId, current.Id);
  });

  const neighbors = computed<[BaseItemDto | undefined, BaseItemDto | undefined]>(() => {
    const current = item();
    const items = resource.value()?.Items;
    if (!current || !items) return [undefined, undefined];
    const index = items.findIndex((it) => it.Id === current.Id);
    if (index < 0) return [undefined, undefined];
    return [items[index - 1], items[index + 1]];
  });

  return {
    previous: computed(() => neighbors()[0]),
    next: computed(() => neighbors()[1]),
    loading: resource.isLoading,
  };
}

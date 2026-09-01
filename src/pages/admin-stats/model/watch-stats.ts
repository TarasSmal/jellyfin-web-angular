import { httpResource } from '@angular/common/http';
import { computed, inject, resource } from '@angular/core';
import { ServerWatchStats, UserPlayHistory, aggregateWatchStats } from '@entities/watch-report';
import {
  ApiConfig,
  ItemCounts,
  UserDto,
  WatchStatsApi,
  itemCountsRequest,
  usersRequest,
} from '@shared/api';

/** The accounts to fan out over, reduced to what the fetch actually needs. */
interface Account {
  id: string;
  name: string;
}

/**
 * The server-wide watch report.
 *
 * Every other read in this app is one `httpResource` over one endpoint. This
 * one cannot be: core Jellyfin keeps watch data on the *item*, per account, so
 * a server-wide picture means one read per account and a fold over all of them
 * (ADR 0006). The fan-out lives in a `resource()` keyed on the account list,
 * so adding or deleting a user re-reads exactly as a plain resource would.
 */
export function injectWatchStats() {
  const config = inject(ApiConfig);
  const api = inject(WatchStatsApi);

  const users = httpResource<UserDto[]>(() => usersRequest(config));
  const counts = httpResource<ItemCounts>(() => itemCountsRequest(config));

  const histories = resource<UserPlayHistory[], Account[] | undefined>({
    params: () => {
      const accounts = users.value();
      if (!accounts?.length) return undefined;
      return accounts.map((user) => ({ id: user.Id, name: user.Name }));
    },
    // `params` is narrowed to the non-undefined case: no accounts, no read.
    loader: ({ params }) =>
      Promise.all(
        params.map(async ({ id, name }) => {
          const page = await api.playedItems(id);
          return {
            userId: id,
            userName: name,
            items: page.items,
            truncated: page.total > page.items.length,
          };
        }),
      ),
  });

  const stats = computed<ServerWatchStats | null>(() => {
    const value = histories.value();
    // Recomputed only when the histories change, so `now` is as fresh as the data.
    return value ? aggregateWatchStats(value, { now: new Date() }) : null;
  });

  return {
    stats,
    counts: counts.value,
    isLoading: computed(() => users.isLoading() || histories.isLoading()),
    error: computed(() => users.error() ?? histories.error() ?? null),
    reload: () => {
      users.reload();
      counts.reload();
      histories.reload();
    },
  };
}

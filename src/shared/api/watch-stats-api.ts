import { HttpClient, HttpResourceRequest } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiConfig } from './api-config';
import { BaseItemDto, ItemsResult } from './types';

/**
 * Reads behind the watch statistics dashboard. Core Jellyfin exposes no
 * playback history endpoint, so server-wide numbers are derived from the
 * per-item user data every account carries — one /Items read per account.
 * See ADR 0006 for why, and for what that costs in fidelity.
 */

/** Server-wide library totals, for the "how much of it has been watched" ratio. */
export function itemCountsRequest(config: ApiConfig): HttpResourceRequest | undefined {
  if (!config.isAuthenticated()) return undefined;
  return { url: config.url('/Items/Counts') };
}

/**
 * Ceiling on played items read per account. A household library rarely gets
 * near it; a hoarder's might, and the page says so rather than lying quietly.
 */
export const PLAYED_ITEMS_LIMIT = 5_000;

/** Only what the aggregation reads — artwork and overviews stay off the wire. */
const STATS_FIELDS = 'Genres,Studios,SeriesStudio';

export interface PlayedItems {
  items: BaseItemDto[];
  /** What the server says exists, so the caller can detect a truncated read. */
  total: number;
}

@Service()
export class WatchStatsApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ApiConfig);

  /**
   * Everything one account has played to completion, newest finish first.
   *
   * Reading another account's items needs admin rights; a rejection resolves
   * to an empty history so one unreadable account cannot blank the dashboard.
   */
  async playedItems(userId: string): Promise<PlayedItems> {
    const request = this.http.get<ItemsResult>(this.config.url('/Items'), {
      params: {
        userId,
        recursive: true,
        filters: 'IsPlayed',
        includeItemTypes: 'Movie,Episode',
        fields: STATS_FIELDS,
        enableImages: false,
        enableUserData: true,
        sortBy: 'DatePlayed',
        sortOrder: 'Descending',
        limit: PLAYED_ITEMS_LIMIT,
      },
    });
    try {
      const result = await firstValueFrom(request);
      return { items: result.Items ?? [], total: result.TotalRecordCount ?? 0 };
    } catch {
      return { items: [], total: 0 };
    }
  }
}

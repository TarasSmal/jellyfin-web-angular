import { HttpResourceRequest } from '@angular/common/http';
import { ApiConfig } from './api-config';

/**
 * Request builders for item browsing, consumed via httpResource() in pages.
 * They return undefined while unauthenticated so resources stay idle.
 * Wire format (paths, params) lives here and nowhere else — ADR 0002.
 */

const ITEM_FIELDS = 'PrimaryImageAspectRatio,Overview,Studios,SeriesStudio';
const IMAGE_TYPES = 'Primary,Backdrop,Thumb,Logo';

type Req = HttpResourceRequest | undefined;

/** The user's libraries ("views" in Jellyfin terms): Movies, TV Shows, … */
export function userViewsRequest(config: ApiConfig): Req {
  const userId = config.userId();
  if (!userId) return undefined;
  return { url: config.url('/UserViews'), params: { userId } };
}

/** Partially-watched video items — the Continue Watching rail. */
export function resumeItemsRequest(config: ApiConfig, limit = 12): Req {
  const userId = config.userId();
  if (!userId) return undefined;
  return {
    url: config.url('/UserItems/Resume'),
    params: {
      userId,
      limit,
      mediaTypes: 'Video',
      fields: ITEM_FIELDS,
      enableImageTypes: IMAGE_TYPES,
    },
  };
}

/** Next unwatched episode per in-progress series — the Next Up rail. */
export function nextUpRequest(config: ApiConfig, limit = 12): Req {
  const userId = config.userId();
  if (!userId) return undefined;
  return {
    url: config.url('/Shows/NextUp'),
    params: { userId, limit, fields: ITEM_FIELDS, enableImageTypes: IMAGE_TYPES },
  };
}

/** One item with full detail fields (cast, genres, overview, chapters). */
export function itemRequest(config: ApiConfig, itemId: string): Req {
  const userId = config.userId();
  if (!userId) return undefined;
  return {
    url: config.url(`/Items/${itemId}`),
    params: { userId, fields: 'People,Genres,Overview,Chapters' },
  };
}

/** Seasons of a series. */
export function seasonsRequest(config: ApiConfig, seriesId: string): Req {
  const userId = config.userId();
  if (!userId) return undefined;
  return { url: config.url(`/Shows/${seriesId}/Seasons`), params: { userId } };
}

/** Episodes of one season. */
export function episodesRequest(config: ApiConfig, seriesId: string, seasonId: string): Req {
  const userId = config.userId();
  if (!userId) return undefined;
  return {
    url: config.url(`/Shows/${seriesId}/Episodes`),
    params: { userId, seasonId, fields: `${ITEM_FIELDS}`, enableImageTypes: IMAGE_TYPES },
  };
}

/**
 * Window of episodes around one episode in series play order, crossing season
 * boundaries. The window contains the episode itself plus its neighbors.
 */
export function adjacentEpisodesRequest(
  config: ApiConfig,
  seriesId: string,
  episodeId: string,
): Req {
  const userId = config.userId();
  if (!userId) return undefined;
  return {
    url: config.url(`/Shows/${seriesId}/Episodes`),
    params: {
      userId,
      adjacentTo: episodeId,
      fields: ITEM_FIELDS,
      enableImageTypes: IMAGE_TYPES,
    },
  };
}

export interface ItemsQuery {
  parentId: string;
  /** Comma-separated Jellyfin kinds, e.g. 'Movie' or 'Series'. */
  includeItemTypes?: string;
  sortBy?: 'SortName' | 'DateCreated' | 'CommunityRating' | 'ProductionYear';
  sortOrder?: 'Ascending' | 'Descending';
  unplayedOnly?: boolean;
  genre?: string;
  startIndex?: number;
  limit?: number;
}

/** Paged, sorted, filtered browse of a library's contents. */
export function itemsRequest(config: ApiConfig, query: ItemsQuery): Req {
  const userId = config.userId();
  if (!userId) return undefined;
  const params: Record<string, string | number | boolean> = {
    userId,
    parentId: query.parentId,
    recursive: true,
    // Server display preferences may group movies into their collections;
    // the grid always shows the movies themselves.
    collapseBoxSetItems: false,
    fields: ITEM_FIELDS,
    enableImageTypes: IMAGE_TYPES,
    imageTypeLimit: 1,
    sortBy: query.sortBy ?? 'SortName',
    sortOrder: query.sortOrder ?? 'Ascending',
    startIndex: query.startIndex ?? 0,
    limit: query.limit ?? 100,
  };
  if (query.includeItemTypes) params['includeItemTypes'] = query.includeItemTypes;
  if (query.unplayedOnly) params['filters'] = 'IsUnplayed';
  if (query.genre) params['genres'] = query.genre;
  return { url: config.url('/Items'), params };
}

/** Title search across movies and series. */
export function searchRequest(config: ApiConfig, term: string): Req {
  const userId = config.userId();
  if (!userId || !term.trim()) return undefined;
  return {
    url: config.url('/Items'),
    params: {
      userId,
      searchTerm: term.trim(),
      recursive: true,
      includeItemTypes: 'Movie,Series',
      limit: 40,
      fields: ITEM_FIELDS,
      enableImageTypes: IMAGE_TYPES,
      imageTypeLimit: 1,
    },
  };
}

/** Genres present inside one library, for the filter dropdown. */
export function genresRequest(config: ApiConfig, parentId: string): Req {
  const userId = config.userId();
  if (!userId) return undefined;
  return { url: config.url('/Genres'), params: { userId, parentId, sortBy: 'SortName' } };
}

/** Most recently added items of one library. Returns a bare array, not ItemsResult. */
export function latestItemsRequest(config: ApiConfig, parentId: string, limit = 16): Req {
  const userId = config.userId();
  if (!userId) return undefined;
  return {
    url: config.url('/Items/Latest'),
    params: { userId, parentId, limit, fields: ITEM_FIELDS, enableImageTypes: IMAGE_TYPES },
  };
}

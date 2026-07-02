import { HttpResourceRequest } from '@angular/common/http';
import { ApiConfig } from './api-config';

/**
 * Request builders for item browsing, consumed via httpResource() in pages.
 * They return undefined while unauthenticated so resources stay idle.
 * Wire format (paths, params) lives here and nowhere else — ADR 0002.
 */

const ITEM_FIELDS = 'PrimaryImageAspectRatio,Overview';
const IMAGE_TYPES = 'Primary,Backdrop,Thumb';

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

/** Most recently added items of one library. Returns a bare array, not ItemsResult. */
export function latestItemsRequest(config: ApiConfig, parentId: string, limit = 16): Req {
  const userId = config.userId();
  if (!userId) return undefined;
  return {
    url: config.url('/Items/Latest'),
    params: { userId, parentId, limit, fields: ITEM_FIELDS, enableImageTypes: IMAGE_TYPES },
  };
}

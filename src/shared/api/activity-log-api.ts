import { HttpResourceRequest } from '@angular/common/http';
import { ApiConfig } from './api-config';

/** One page of the server's activity log, newest first. Admin-only endpoint. */
export function activityLogRequest(
  config: ApiConfig,
  query: { startIndex?: number; limit?: number } = {},
): HttpResourceRequest | undefined {
  if (!config.isAuthenticated()) return undefined;
  return {
    url: config.url('/System/ActivityLog/Entries'),
    params: { startIndex: query.startIndex ?? 0, limit: query.limit ?? 25 },
  };
}

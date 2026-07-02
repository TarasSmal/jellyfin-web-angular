import { HttpResourceRequest } from '@angular/common/http';
import { ApiConfig } from './api-config';

/**
 * Sessions the server has seen recently — the admin view of connected
 * devices and active playback. Admin-only endpoint.
 */
export function sessionsRequest(
  config: ApiConfig,
  activeWithinSeconds = 960,
): HttpResourceRequest | undefined {
  if (!config.isAuthenticated()) return undefined;
  return { url: config.url('/Sessions'), params: { activeWithinSeconds } };
}

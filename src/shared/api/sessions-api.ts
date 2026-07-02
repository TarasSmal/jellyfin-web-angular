import { HttpClient, HttpResourceRequest } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
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

/** Remote control of other sessions; only works when SupportsRemoteControl. */
@Service()
export class SessionsApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ApiConfig);

  sendMessage(sessionId: string, text: string): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(this.config.url(`/Sessions/${sessionId}/Message`), {
        Header: 'Message from admin',
        Text: text,
        TimeoutMs: 10_000,
      }),
    );
  }

  stopPlayback(sessionId: string): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(this.config.url(`/Sessions/${sessionId}/Playing/Stop`), null),
    );
  }
}

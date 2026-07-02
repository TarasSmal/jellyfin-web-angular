import { HttpClient, HttpResourceRequest } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiConfig } from './api-config';
import { PublicSystemInfo } from './types';

/** Full system info — the server only answers this for admin tokens. */
export function systemInfoRequest(config: ApiConfig): HttpResourceRequest | undefined {
  if (!config.isAuthenticated()) return undefined;
  return { url: config.url('/System/Info') };
}

@Injectable({ providedIn: 'root' })
export class SystemApi {
  private readonly http = inject(HttpClient);

  /**
   * Probes a candidate server URL before it's saved — hence the explicit
   * `serverUrl` argument instead of ApiConfig.
   */
  getPublicInfo(serverUrl: string): Promise<PublicSystemInfo> {
    const base = serverUrl.replace(/\/+$/, '');
    return firstValueFrom(this.http.get<PublicSystemInfo>(`${base}/System/Info/Public`));
  }
}

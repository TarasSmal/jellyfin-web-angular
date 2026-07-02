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

/** Disk usage of the server's data folders and library paths. Admin-only. */
export function systemStorageRequest(config: ApiConfig): HttpResourceRequest | undefined {
  if (!config.isAuthenticated()) return undefined;
  return { url: config.url('/System/Info/Storage') };
}

@Injectable({ providedIn: 'root' })
export class SystemApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ApiConfig);

  /**
   * Probes a candidate server URL before it's saved — hence the explicit
   * `serverUrl` argument instead of ApiConfig.
   */
  getPublicInfo(serverUrl: string): Promise<PublicSystemInfo> {
    const base = serverUrl.replace(/\/+$/, '');
    return firstValueFrom(this.http.get<PublicSystemInfo>(`${base}/System/Info/Public`));
  }

  restart(): Promise<void> {
    return firstValueFrom(this.http.post<void>(this.config.url('/System/Restart'), null));
  }

  shutdown(): Promise<void> {
    return firstValueFrom(this.http.post<void>(this.config.url('/System/Shutdown'), null));
  }
}

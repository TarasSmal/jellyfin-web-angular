import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PublicSystemInfo } from './types';

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

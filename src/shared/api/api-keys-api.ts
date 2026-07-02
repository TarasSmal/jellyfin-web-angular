import { HttpClient, HttpResourceRequest } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiConfig } from './api-config';

/** Server-to-server API keys (not user sessions). Admin-only endpoint. */
export function apiKeysRequest(config: ApiConfig): HttpResourceRequest | undefined {
  if (!config.isAuthenticated()) return undefined;
  return { url: config.url('/Auth/Keys') };
}

@Service()
export class ApiKeysApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ApiConfig);

  create(appName: string): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(this.config.url('/Auth/Keys'), null, { params: { app: appName } }),
    );
  }

  revoke(key: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(this.config.url(`/Auth/Keys/${key}`)));
  }
}

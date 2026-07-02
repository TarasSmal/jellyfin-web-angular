import { HttpClient, HttpResourceRequest } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiConfig } from './api-config';
import { ServerConfiguration } from './types';

/** The server's main configuration object. Admin-only endpoint. */
export function systemConfigRequest(config: ApiConfig): HttpResourceRequest | undefined {
  if (!config.isAuthenticated()) return undefined;
  return { url: config.url('/System/Configuration') };
}

@Service()
export class SystemConfigApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ApiConfig);

  /** `configuration` must be the complete object — see ServerConfiguration. */
  update(configuration: ServerConfiguration): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(this.config.url('/System/Configuration'), configuration),
    );
  }
}

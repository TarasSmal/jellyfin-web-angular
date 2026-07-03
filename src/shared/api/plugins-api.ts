import { HttpClient, HttpResourceRequest } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiConfig } from './api-config';

/** Installed plugins. Admin-only endpoint. */
export function pluginsRequest(config: ApiConfig): HttpResourceRequest | undefined {
  if (!config.isAuthenticated()) return undefined;
  return { url: config.url('/Plugins') };
}

/** The plugin catalog from configured repositories. Admin-only endpoint. */
export function packagesRequest(config: ApiConfig): HttpResourceRequest | undefined {
  if (!config.isAuthenticated()) return undefined;
  return { url: config.url('/Packages') };
}

@Service()
export class PluginsApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ApiConfig);

  setEnabled(pluginId: string, version: string, enabled: boolean): Promise<void> {
    const action = enabled ? 'Enable' : 'Disable';
    return firstValueFrom(
      this.http.post<void>(this.config.url(`/Plugins/${pluginId}/${version}/${action}`), null),
    );
  }

  uninstall(pluginId: string, version: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(this.config.url(`/Plugins/${pluginId}/${version}`)),
    );
  }

  /** Starts a background download+install; the plugin lands after a restart. */
  install(name: string, assemblyGuid: string, version?: string): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(
        this.config.url(`/Packages/Installed/${encodeURIComponent(name)}`),
        null,
        {
          params: { assemblyGuid, ...(version ? { version } : {}) },
        },
      ),
    );
  }
}

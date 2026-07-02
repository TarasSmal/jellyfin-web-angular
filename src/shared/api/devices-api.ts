import { HttpClient, HttpResourceRequest } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiConfig } from './api-config';

/** Every device that has signed in. Admin-only endpoint. */
export function devicesRequest(config: ApiConfig): HttpResourceRequest | undefined {
  if (!config.isAuthenticated()) return undefined;
  return { url: config.url('/Devices') };
}

@Service()
export class DevicesApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ApiConfig);

  rename(deviceId: string, customName: string): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(
        this.config.url('/Devices/Options'),
        { CustomName: customName },
        { params: { id: deviceId } },
      ),
    );
  }

  /** Also revokes the device's sessions. */
  remove(deviceId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(this.config.url('/Devices'), { params: { id: deviceId } }),
    );
  }
}

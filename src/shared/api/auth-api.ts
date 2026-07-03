import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiConfig } from './api-config';
import { buildAuthHeader } from './auth-header';
import { AuthenticationResult, UserDto } from './types';

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ApiConfig);

  authenticateByName(username: string, password: string): Promise<AuthenticationResult> {
    // Explicit header: authentication happens before a token exists, and the
    // MediaBrowser identity header is required for the server to issue one.
    return firstValueFrom(
      this.http.post<AuthenticationResult>(
        this.config.url('/Users/AuthenticateByName'),
        { Username: username, Pw: password },
        { headers: new HttpHeaders({ Authorization: buildAuthHeader(null) }) },
      ),
    );
  }

  /** The user attached to the current access token; fails if the token was revoked. */
  getCurrentUser(): Promise<UserDto> {
    return firstValueFrom(this.http.get<UserDto>(this.config.url('/Users/Me')));
  }

  logout(): Promise<void> {
    return firstValueFrom(this.http.post<void>(this.config.url('/Sessions/Logout'), null));
  }
}

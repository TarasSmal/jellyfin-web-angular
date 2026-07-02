import { Injectable, inject } from '@angular/core';
import { ApiConfig, AuthApi, SystemApi, PublicSystemInfo } from '@shared/api';
import { SessionStore } from '@entities/user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly config = inject(ApiConfig);
  private readonly systemApi = inject(SystemApi);
  private readonly authApi = inject(AuthApi);
  private readonly session = inject(SessionStore);

  /** Probe the URL as a Jellyfin server; save it only if it responds. */
  async connect(serverUrl: string): Promise<PublicSystemInfo> {
    const info = await this.systemApi.getPublicInfo(serverUrl);
    this.config.setServer(serverUrl);
    return info;
  }

  async login(username: string, password: string): Promise<void> {
    const result = await this.authApi.authenticateByName(username, password);
    this.config.setSession(result.AccessToken, result.User.Id);
    this.session.setUser(result.User);
  }

  /**
   * Re-validate a persisted token on app start. Returns false (and clears the
   * stale session) if the server rejects it.
   */
  async restoreSession(): Promise<boolean> {
    if (!this.config.isAuthenticated()) return false;
    try {
      this.session.setUser(await this.authApi.getCurrentUser());
      return true;
    } catch {
      this.config.clearSession();
      this.session.setUser(null);
      return false;
    }
  }

  async logout(): Promise<void> {
    try {
      await this.authApi.logout();
    } catch {
      // Server-side session cleanup is best-effort; local logout must not fail.
    }
    this.config.clearSession();
    this.session.setUser(null);
  }
}

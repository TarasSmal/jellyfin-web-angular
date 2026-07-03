import { Injectable, computed, signal } from '@angular/core';

const SERVER_KEY = 'jf.serverUrl';
const TOKEN_KEY = 'jf.accessToken';
const USER_KEY = 'jf.userId';

/**
 * Connection state for the Jellyfin server: base URL + access token.
 * Persisted to localStorage so a page reload keeps the session.
 */
@Injectable({ providedIn: 'root' })
export class ApiConfig {
  private readonly _serverUrl = signal<string | null>(localStorage.getItem(SERVER_KEY));
  private readonly _accessToken = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  private readonly _userId = signal<string | null>(localStorage.getItem(USER_KEY));

  readonly serverUrl = this._serverUrl.asReadonly();
  readonly accessToken = this._accessToken.asReadonly();
  readonly userId = this._userId.asReadonly();

  readonly isConnected = computed(() => this._serverUrl() !== null);
  readonly isAuthenticated = computed(
    () => this._accessToken() !== null && this._userId() !== null,
  );

  /** Prefix a relative Jellyfin API path with the configured server URL. */
  url(path: string): string {
    const base = this._serverUrl();
    if (!base) throw new Error('No Jellyfin server configured');
    return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  setServer(url: string): void {
    const normalized = url.replace(/\/+$/, '');
    this._serverUrl.set(normalized);
    localStorage.setItem(SERVER_KEY, normalized);
  }

  setSession(accessToken: string, userId: string): void {
    this._accessToken.set(accessToken);
    this._userId.set(userId);
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(USER_KEY, userId);
  }

  clearSession(): void {
    this._accessToken.set(null);
    this._userId.set(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
}

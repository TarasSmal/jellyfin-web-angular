import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiConfig, UserDto } from '@shared/api';

/** The logged-in Jellyfin user. Token/server state lives in ApiConfig; this holds the profile. */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly config = inject(ApiConfig);

  private readonly _user = signal<UserDto | null>(null);
  readonly user = this._user.asReadonly();

  readonly isLoggedIn = computed(() => this.config.isAuthenticated());
  readonly isAdmin = computed(() => this._user()?.Policy?.IsAdministrator ?? false);

  setUser(user: UserDto | null): void {
    this._user.set(user);
  }
}

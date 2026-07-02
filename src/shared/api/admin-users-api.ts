import { HttpClient, HttpResourceRequest } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiConfig } from './api-config';
import { UserDto, UserPolicy } from './types';

/** Every account on the server. Admin-only endpoint. */
export function usersRequest(config: ApiConfig): HttpResourceRequest | undefined {
  if (!config.isAuthenticated()) return undefined;
  return { url: config.url('/Users') };
}

/** Admin mutations on user accounts. */
@Service()
export class AdminUsersApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ApiConfig);

  createUser(name: string, password: string): Promise<UserDto> {
    return firstValueFrom(
      this.http.post<UserDto>(this.config.url('/Users/New'), { Name: name, Password: password }),
    );
  }

  /** `policy` must be the complete policy object — see UserPolicy. */
  updatePolicy(userId: string, policy: UserPolicy): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(this.config.url(`/Users/${userId}/Policy`), policy),
    );
  }

  /**
   * Admin override of another user's password. The body's ResetPassword flag
   * is rejected by Jellyfin 12, so "reset" means setting a new password.
   */
  setPassword(userId: string, newPassword: string): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(
        this.config.url('/Users/Password'),
        { NewPw: newPassword },
        { params: { userId } },
      ),
    );
  }

  deleteUser(userId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(this.config.url(`/Users/${userId}`)));
  }
}

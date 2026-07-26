import { HttpClient, HttpHeaders, HttpResourceRequest } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiConfig } from './api-config';
import { UserConfiguration, UserDto } from './types';

/**
 * The signed-in account, including its Configuration — the profile page's
 * source of truth. `/Users/{id}` is admin-only, `/Users/Me` is not.
 */
export function currentUserRequest(config: ApiConfig): HttpResourceRequest | undefined {
  if (!config.isAuthenticated()) return undefined;
  return { url: config.url('/Users/Me') };
}

/**
 * Avatar URL, or null when the account has no picture. The tag is the image's
 * content hash: including it busts the browser cache after an upload.
 * The endpoint takes no sizing params — callers constrain the rendered size.
 */
export function userImageUrl(
  config: ApiConfig,
  user: { Id: string; PrimaryImageTag?: string },
): string | null {
  if (!user.PrimaryImageTag) return null;
  return `${config.url('/UserImage')}?userId=${user.Id}&tag=${user.PrimaryImageTag}`;
}

/** Content types the server accepts for a profile picture. */
export const PROFILE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** Self-service edits to the signed-in account. Every call is allowed without admin rights. */
@Service()
export class UserProfileApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ApiConfig);

  /**
   * Renames the account. `user` must be the complete DTO as fetched — the
   * server replaces the stored record with it.
   */
  updateProfile(user: UserDto): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(this.config.url('/Users'), user, { params: { userId: user.Id } }),
    );
  }

  /** `configuration` must be the complete object — see UserConfiguration. */
  updateConfiguration(userId: string, configuration: UserConfiguration): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(this.config.url('/Users/Configuration'), configuration, {
        params: { userId },
      }),
    );
  }

  /**
   * Changes your own password. The server checks `CurrentPw` and answers 403
   * when it is wrong; an account without a password sends an empty string.
   */
  changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(
        this.config.url('/Users/Password'),
        { CurrentPw: currentPassword, NewPw: newPassword },
        { params: { userId } },
      ),
    );
  }

  /** Uploads the avatar as raw bytes; the Content-Type tells the server the format. */
  uploadImage(userId: string, file: File): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(this.config.url('/UserImage'), file, {
        params: { userId },
        headers: new HttpHeaders({ 'Content-Type': file.type }),
      }),
    );
  }

  deleteImage(userId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(this.config.url('/UserImage'), { params: { userId } }),
    );
  }
}

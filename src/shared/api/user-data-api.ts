import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiConfig } from './api-config';
import { UserItemData } from './types';

@Injectable({ providedIn: 'root' })
export class UserDataApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ApiConfig);

  private params() {
    return { userId: this.config.userId() ?? '' };
  }

  setFavorite(itemId: string, favorite: boolean): Promise<UserItemData> {
    const url = this.config.url(`/UserFavoriteItems/${itemId}`);
    const options = { params: this.params() };
    return firstValueFrom(
      favorite
        ? this.http.post<UserItemData>(url, null, options)
        : this.http.delete<UserItemData>(url, options),
    );
  }

  setPlayed(itemId: string, played: boolean): Promise<UserItemData> {
    const url = this.config.url(`/UserPlayedItems/${itemId}`);
    const options = { params: this.params() };
    return firstValueFrom(
      played
        ? this.http.post<UserItemData>(url, null, options)
        : this.http.delete<UserItemData>(url, options),
    );
  }
}

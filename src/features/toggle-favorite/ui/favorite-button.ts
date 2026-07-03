import { Component, inject, input, linkedSignal } from '@angular/core';
import { BaseItemDto, UserDataApi } from '@shared/api';
import { ToastService } from '@shared/ui/toast';

@Component({
  selector: 'jf-favorite-button',
  templateUrl: './favorite-button.html',
})
export class FavoriteButton {
  private readonly api = inject(UserDataApi);
  private readonly toasts = inject(ToastService);

  readonly item = input.required<BaseItemDto>();

  protected readonly isFavorite = linkedSignal(() => this.item().UserData?.IsFavorite ?? false);

  async toggle(): Promise<void> {
    const next = !this.isFavorite();
    this.isFavorite.set(next); // optimistic
    try {
      await this.api.setFavorite(this.item().Id, next);
    } catch {
      this.isFavorite.set(!next);
      this.toasts.show('Could not update favorite.');
    }
  }
}

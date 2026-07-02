import { Component, inject, input, linkedSignal } from '@angular/core';
import { BaseItemDto, UserDataApi } from '@shared/api';
import { ToastService } from '@shared/ui/toast';

@Component({
  selector: 'app-favorite-button',
  template: `
    <button
      type="button"
      class="flex h-11 w-11 items-center justify-center rounded-full border transition-colors"
      [class.border-accent]="isFavorite()"
      [class.text-accent]="isFavorite()"
      [class.border-border]="!isFavorite()"
      [class.text-text-muted]="!isFavorite()"
      [class.hover:text-text]="!isFavorite()"
      [attr.aria-pressed]="isFavorite()"
      title="Favorite"
      (click)="toggle()"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" [attr.fill]="isFavorite() ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  `,
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

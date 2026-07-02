import { Component, inject, input, linkedSignal } from '@angular/core';
import { BaseItemDto, UserDataApi } from '@shared/api';

@Component({
  selector: 'app-watched-button',
  template: `
    <button
      type="button"
      class="flex h-11 w-11 items-center justify-center rounded-full border transition-colors"
      [class.border-accent]="isPlayed()"
      [class.text-accent]="isPlayed()"
      [class.border-border]="!isPlayed()"
      [class.text-text-muted]="!isPlayed()"
      [class.hover:text-text]="!isPlayed()"
      [attr.aria-pressed]="isPlayed()"
      title="Mark watched"
      (click)="toggle()"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </button>
  `,
})
export class WatchedButton {
  private readonly api = inject(UserDataApi);

  readonly item = input.required<BaseItemDto>();

  protected readonly isPlayed = linkedSignal(() => this.item().UserData?.Played ?? false);

  async toggle(): Promise<void> {
    const next = !this.isPlayed();
    this.isPlayed.set(next); // optimistic
    try {
      await this.api.setPlayed(this.item().Id, next);
    } catch {
      this.isPlayed.set(!next);
    }
  }
}

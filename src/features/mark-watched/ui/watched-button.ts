import { Component, inject, input, linkedSignal } from '@angular/core';
import { BaseItemDto, UserDataApi } from '@shared/api';
import { ToastService } from '@shared/ui/toast';

@Component({
  selector: 'jf-watched-button',
  templateUrl: './watched-button.html',
})
export class WatchedButton {
  private readonly api = inject(UserDataApi);
  private readonly toasts = inject(ToastService);

  readonly item = input.required<BaseItemDto>();

  protected readonly isPlayed = linkedSignal(() => this.item().UserData?.Played ?? false);

  async toggle(): Promise<void> {
    const next = !this.isPlayed();
    this.isPlayed.set(next); // optimistic
    try {
      await this.api.setPlayed(this.item().Id, next);
    } catch {
      this.isPlayed.set(!next);
      this.toasts.show('Could not update watched state.');
    }
  }
}

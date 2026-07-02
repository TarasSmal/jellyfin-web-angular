import { Component, Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  BrnDialogDescription,
  BrnDialogRef,
  BrnDialogService,
  BrnDialogTitle,
  injectBrnDialogContext,
} from '@spartan-ng/brain/dialog';

export interface ConfirmOptions {
  title: string;
  message: string;
  /** Defaults to 'Confirm'. */
  confirmLabel?: string;
  /** Styles the confirm button as destructive. */
  danger?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  imports: [BrnDialogTitle, BrnDialogDescription],
  host: {
    class: 'block w-[min(92vw,26rem)] rounded-xl border border-border bg-surface-raised p-6 shadow-2xl',
  },
  template: `
    <h2 brnDialogTitle class="text-lg font-semibold">{{ options.title }}</h2>
    <p brnDialogDescription class="mt-2 text-sm text-text-muted">{{ options.message }}</p>
    <div class="mt-6 flex justify-end gap-2">
      <button
        type="button"
        class="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-surface"
        (click)="ref.close(false)"
      >
        Cancel
      </button>
      <button
        type="button"
        class="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
        [class.bg-danger]="options.danger"
        [class.hover:bg-danger/80]="options.danger"
        [class.bg-accent]="!options.danger"
        [class.hover:bg-accent-hover]="!options.danger"
        (click)="ref.close(true)"
      >
        {{ options.confirmLabel ?? 'Confirm' }}
      </button>
    </div>
  `,
})
export class ConfirmDialog {
  protected readonly options = injectBrnDialogContext<ConfirmOptions>();
  protected readonly ref = inject<BrnDialogRef<boolean>>(BrnDialogRef);
}

/** Imperative confirmation: `if (await confirm.ask({...})) { ... }` */
@Service()
export class ConfirmService {
  private readonly dialogs = inject(BrnDialogService);

  async ask(options: ConfirmOptions): Promise<boolean> {
    const ref = this.dialogs.open<ConfirmOptions, boolean>(ConfirmDialog, undefined, options, {
      role: 'alertdialog',
      backdropClass: 'bg-black/60',
    });
    return (await firstValueFrom(ref.closed$)) === true;
  }
}

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
  selector: 'jf-confirm-dialog',
  imports: [BrnDialogTitle, BrnDialogDescription],
  host: {
    class:
      'block w-[min(92vw,26rem)] rounded-xl border border-border bg-surface-raised p-6 shadow-2xl',
  },
  templateUrl: './confirm-dialog.html',
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

import { Component, Service, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  BrnDialogDescription,
  BrnDialogRef,
  BrnDialogService,
  BrnDialogTitle,
  injectBrnDialogContext,
} from '@spartan-ng/brain/dialog';

export interface PromptOptions {
  title: string;
  message: string;
  /** Label above the input. */
  label: string;
  /** Defaults to 'text'. */
  inputType?: 'text' | 'password';
  /** Defaults to 'Save'. */
  confirmLabel?: string;
}

@Component({
  selector: 'jf-prompt-dialog',
  imports: [BrnDialogTitle, BrnDialogDescription],
  host: {
    class:
      'block w-[min(92vw,26rem)] rounded-xl border border-border bg-surface-raised p-6 shadow-2xl',
  },
  templateUrl: './prompt-dialog.html',
})
export class PromptDialog {
  protected readonly options = injectBrnDialogContext<PromptOptions>();
  protected readonly ref = inject<BrnDialogRef<string | null>>(BrnDialogRef);
  protected readonly value = signal('');

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }

  protected submit(event: Event): void {
    event.preventDefault();
    if (this.value().trim()) this.ref.close(this.value());
  }
}

/** Imperative single-input prompt; resolves to the entered value or null on cancel. */
@Service()
export class PromptService {
  private readonly dialogs = inject(BrnDialogService);

  async ask(options: PromptOptions): Promise<string | null> {
    const ref = this.dialogs.open<PromptOptions, string | null>(PromptDialog, undefined, options, {
      backdropClass: 'bg-black/60',
    });
    return (await firstValueFrom(ref.closed$)) ?? null;
  }
}

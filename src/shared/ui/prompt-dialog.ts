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
  selector: 'app-prompt-dialog',
  imports: [BrnDialogTitle, BrnDialogDescription],
  host: {
    class: 'block w-[min(92vw,26rem)] rounded-xl border border-border bg-surface-raised p-6 shadow-2xl',
  },
  template: `
    <h2 brnDialogTitle class="text-lg font-semibold">{{ options.title }}</h2>
    <p brnDialogDescription class="mt-2 text-sm text-text-muted">{{ options.message }}</p>
    <form class="mt-4" (submit)="submit($event)">
      <label class="block text-sm">
        <span class="mb-1 block text-text-muted">{{ options.label }}</span>
        <input
          [type]="options.inputType ?? 'text'"
          autocomplete="off"
          class="w-full rounded-lg border border-border bg-surface px-3 py-2 focus:border-accent focus:outline-none"
          [value]="value()"
          (input)="onInput($event)"
        />
      </label>
      <div class="mt-6 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-surface"
          (click)="ref.close(null)"
        >
          Cancel
        </button>
        <button
          type="submit"
          [disabled]="!value().trim()"
          class="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {{ options.confirmLabel ?? 'Save' }}
        </button>
      </div>
    </form>
  `,
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

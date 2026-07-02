import { Component, Injectable, inject, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  kind: 'error' | 'info';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  readonly toasts = signal<Toast[]>([]);

  show(message: string, kind: Toast['kind'] = 'error'): void {
    const toast = { id: this.nextId++, message, kind };
    this.toasts.update((all) => [...all, toast]);
    setTimeout(() => this.dismiss(toast.id), 5000);
  }

  dismiss(id: number): void {
    this.toasts.update((all) => all.filter((t) => t.id !== id));
  }
}

@Component({
  selector: 'app-toast-container',
  template: `
    <div class="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex flex-col items-center gap-2">
      @for (toast of service.toasts(); track toast.id) {
        <button
          type="button"
          class="pointer-events-auto rounded-lg border px-4 py-2.5 text-sm shadow-xl backdrop-blur"
          [class.border-danger]="toast.kind === 'error'"
          [class.bg-danger]="toast.kind === 'error'"
          [class.text-white]="toast.kind === 'error'"
          [class.border-border]="toast.kind === 'info'"
          [class.bg-surface-raised]="toast.kind === 'info'"
          (click)="service.dismiss(toast.id)"
        >
          {{ toast.message }}
        </button>
      }
    </div>
  `,
})
export class ToastContainer {
  protected readonly service = inject(ToastService);
}

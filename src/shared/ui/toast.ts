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
  selector: 'jf-toast-container',
  templateUrl: './toast.html',
})
export class ToastContainer {
  protected readonly service = inject(ToastService);
}

import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@features/auth';

@Component({
  selector: 'app-connect-page',
  imports: [FormsModule],
  template: `
    <main class="flex min-h-dvh items-center justify-center p-6">
      <form
        class="w-full max-w-sm space-y-6"
        (ngSubmit)="submit()"
      >
        <div class="space-y-2 text-center">
          <h1 class="text-3xl font-bold tracking-tight">Jellyfin</h1>
          <p class="text-text-muted">Enter the address of your server</p>
        </div>

        <input
          type="url"
          name="serverUrl"
          required
          placeholder="https://jellyfin.example.com"
          class="w-full rounded-lg border border-border bg-surface px-4 py-3 text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
          [(ngModel)]="serverUrl"
          [disabled]="busy()"
        />

        @if (error()) {
          <p class="text-sm text-danger">{{ error() }}</p>
        }

        <button
          type="submit"
          class="w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          [disabled]="busy() || !serverUrl().trim()"
        >
          {{ busy() ? 'Connecting…' : 'Connect' }}
        </button>
      </form>
    </main>
  `,
})
export class ConnectPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly serverUrl = signal('');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  async submit(): Promise<void> {
    const url = this.serverUrl().trim();
    if (!url || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.connect(url);
      await this.router.navigate(['/login']);
    } catch {
      this.error.set('Could not reach a Jellyfin server at that address.');
    } finally {
      this.busy.set(false);
    }
  }
}

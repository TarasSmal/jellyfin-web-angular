import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@features/auth';
import { ApiConfig } from '@shared/api';

@Component({
  selector: 'app-login-page',
  imports: [FormsModule, RouterLink],
  template: `
    <main class="flex min-h-dvh items-center justify-center p-6">
      <form class="w-full max-w-sm space-y-6" (ngSubmit)="submit()">
        <div class="space-y-2 text-center">
          <h1 class="text-3xl font-bold tracking-tight">Sign in</h1>
          <p class="text-text-muted">
            {{ config.serverUrl() }}
            <a routerLink="/connect" class="text-accent hover:text-accent-hover">change</a>
          </p>
        </div>

        <div class="space-y-3">
          <input
            type="text"
            name="username"
            required
            autocomplete="username"
            placeholder="Username"
            class="w-full rounded-lg border border-border bg-surface px-4 py-3 text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
            [(ngModel)]="username"
            [disabled]="busy()"
          />
          <input
            type="password"
            name="password"
            autocomplete="current-password"
            placeholder="Password"
            class="w-full rounded-lg border border-border bg-surface px-4 py-3 text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
            [(ngModel)]="password"
            [disabled]="busy()"
          />
        </div>

        @if (error()) {
          <p class="text-sm text-danger">{{ error() }}</p>
        }

        <button
          type="submit"
          class="w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          [disabled]="busy() || !username().trim()"
        >
          {{ busy() ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
    </main>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly config = inject(ApiConfig);

  readonly username = signal('');
  readonly password = signal('');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  async submit(): Promise<void> {
    if (this.busy() || !this.username().trim()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.login(this.username().trim(), this.password());
      await this.router.navigate(['/']);
    } catch {
      this.error.set('Sign-in failed. Check your username and password.');
    } finally {
      this.busy.set(false);
    }
  }
}

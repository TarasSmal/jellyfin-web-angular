import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@features/auth';
import { SessionStore } from '@entities/user';

@Component({
  selector: 'app-home-page',
  template: `
    <main class="mx-auto max-w-5xl space-y-4 p-8">
      <h1 class="text-2xl font-bold">
        Welcome{{ session.user()?.Name ? ', ' + session.user()!.Name : '' }}
      </h1>
      <p class="text-text-muted">Home page with rails lands in the next step.</p>
      <button
        type="button"
        class="rounded-lg border border-border px-4 py-2 text-text-muted transition-colors hover:text-text"
        (click)="logout()"
      >
        Sign out
      </button>
    </main>
  `,
})
export class HomePage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly session = inject(SessionStore);

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}

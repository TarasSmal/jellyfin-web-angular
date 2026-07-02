import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '@features/auth';
import { SessionStore } from '@entities/user';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="fixed inset-x-0 top-0 z-40 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
      <nav class="flex h-16 items-center gap-6 px-6 md:px-12">
        <a routerLink="/" class="text-xl font-bold tracking-tight text-accent">Jellyfin</a>
        <a
          routerLink="/"
          routerLinkActive="text-text"
          [routerLinkActiveOptions]="{ exact: true }"
          class="text-sm font-medium text-text-muted transition-colors hover:text-text"
        >
          Home
        </a>
        <span class="flex-1"></span>
        <span class="hidden text-sm text-text-muted sm:inline">{{ session.user()?.Name }}</span>
        <button
          type="button"
          class="text-sm text-text-muted transition-colors hover:text-text"
          (click)="logout()"
        >
          Sign out
        </button>
      </nav>
    </header>
    <router-outlet />
  `,
})
export class AppShell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly session = inject(SessionStore);

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}

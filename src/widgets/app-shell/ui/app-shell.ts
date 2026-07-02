import { Component, computed, inject } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ApiConfig, ItemsResult, userViewsRequest } from '@shared/api';
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
        @for (view of libraries(); track view.Id) {
          <a
            [routerLink]="['/library', view.Id]"
            routerLinkActive="text-text"
            class="text-sm font-medium text-text-muted transition-colors hover:text-text"
          >
            {{ view.Name }}
          </a>
        }
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
  private readonly config = inject(ApiConfig);
  protected readonly session = inject(SessionStore);

  private readonly views = httpResource<ItemsResult>(() => userViewsRequest(this.config));
  /** Only video libraries get nav links — phase-1 scope is movies + TV. */
  protected readonly libraries = computed(
    () =>
      this.views.value()?.Items.filter(
        (v) => v.CollectionType === 'movies' || v.CollectionType === 'tvshows',
      ) ?? [],
  );

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}

import { Component, computed, inject, signal } from '@angular/core';
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
      <nav class="flex h-16 items-center gap-4 overflow-x-auto px-4 md:gap-6 md:px-12">
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
            class="shrink-0 text-sm font-medium text-text-muted transition-colors hover:text-text"
          >
            {{ view.Name }}
          </a>
        }
        <span class="flex-1"></span>
        <input
          type="search"
          placeholder="Search"
          class="w-24 shrink-0 rounded-full border border-border bg-surface/80 px-4 py-1.5 text-sm placeholder:text-text-faint focus:w-40 focus:border-accent focus:outline-none transition-all sm:w-40 sm:focus:w-56"
          [value]="searchTerm()"
          (input)="onSearch($event)"
        />
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

  protected readonly searchTerm = signal('');
  private searchDebounce: ReturnType<typeof setTimeout> | null = null;

  protected onSearch(event: Event): void {
    const term = (event.target as HTMLInputElement).value;
    this.searchTerm.set(term);
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => {
      if (term.trim()) {
        void this.router.navigate(['/search'], { queryParams: { q: term.trim() } });
      }
    }, 300);
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}

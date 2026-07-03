import { Component, computed, inject, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ApiConfig, ItemsResult, userViewsRequest } from '@shared/api';
import { AuthService } from '@features/auth';
import { SessionStore } from '@entities/user';

@Component({
  selector: 'jf-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app-shell.html',
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
      this.views
        .value()
        ?.Items.filter((v) => v.CollectionType === 'movies' || v.CollectionType === 'tvshows') ??
      [],
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

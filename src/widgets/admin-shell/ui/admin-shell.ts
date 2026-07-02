import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/** Layout for the admin dashboard: left section nav + content outlet. */
@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="mx-auto flex max-w-7xl flex-col gap-8 px-4 pt-24 pb-16 md:flex-row md:px-12">
      <aside class="w-full shrink-0 md:w-48">
        <h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
          Dashboard
        </h2>
        <nav
          aria-label="Admin sections"
          class="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible"
        >
          @for (section of sections; track section.path) {
            <a
              [routerLink]="section.path"
              routerLinkActive="bg-surface-raised text-text"
              ariaCurrentWhenActive="page"
              [routerLinkActiveOptions]="{ exact: true }"
              class="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:text-text"
            >
              {{ section.label }}
            </a>
          }
        </nav>
      </aside>
      <div class="min-w-0 flex-1">
        <router-outlet />
      </div>
    </div>
  `,
})
export class AdminShell {
  protected readonly sections = [
    { label: 'Overview', path: '/admin' },
    { label: 'Activity', path: '/admin/activity' },
    { label: 'Users', path: '/admin/users' },
    { label: 'Libraries', path: '/admin/libraries' },
    { label: 'Tasks', path: '/admin/tasks' },
    { label: 'Devices', path: '/admin/devices' },
    { label: 'API Keys', path: '/admin/keys' },
    { label: 'Logs', path: '/admin/logs' },
  ];
}

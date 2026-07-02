import { Routes } from '@angular/router';
import { adminGuard, authGuard, connectedGuard } from '@features/auth';

export const routes: Routes = [
  {
    path: 'connect',
    loadComponent: () => import('@pages/connect').then((m) => m.ConnectPage),
  },
  {
    path: 'login',
    canActivate: [connectedGuard],
    loadComponent: () => import('@pages/login').then((m) => m.LoginPage),
  },
  {
    // Full-screen player lives outside the shell (no nav chrome).
    path: 'player/:id',
    canActivate: [authGuard],
    loadComponent: () => import('@pages/player').then((m) => m.PlayerPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('@widgets/app-shell').then((m) => m.AppShell),
    children: [
      {
        path: '',
        loadComponent: () => import('@pages/home').then((m) => m.HomePage),
      },
      {
        path: 'library/:id',
        loadComponent: () => import('@pages/library').then((m) => m.LibraryPage),
      },
      {
        path: 'item/:id',
        loadComponent: () => import('@pages/item').then((m) => m.ItemPage),
      },
      {
        path: 'search',
        loadComponent: () => import('@pages/search').then((m) => m.SearchPage),
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        loadComponent: () => import('@widgets/admin-shell').then((m) => m.AdminShell),
        children: [
          {
            path: '',
            loadComponent: () =>
              import('@pages/admin-dashboard').then((m) => m.AdminDashboardPage),
          },
          {
            path: 'settings',
            loadComponent: () =>
              import('@pages/admin-settings').then((m) => m.AdminSettingsPage),
          },
          {
            path: 'activity',
            loadComponent: () =>
              import('@pages/admin-activity').then((m) => m.AdminActivityPage),
          },
          {
            path: 'users',
            loadComponent: () => import('@pages/admin-users').then((m) => m.AdminUsersPage),
          },
          {
            path: 'users/:id',
            loadComponent: () => import('@pages/admin-user').then((m) => m.AdminUserPage),
          },
          {
            path: 'libraries',
            loadComponent: () =>
              import('@pages/admin-libraries').then((m) => m.AdminLibrariesPage),
          },
          {
            path: 'tasks',
            loadComponent: () => import('@pages/admin-tasks').then((m) => m.AdminTasksPage),
          },
          {
            path: 'devices',
            loadComponent: () =>
              import('@pages/admin-devices').then((m) => m.AdminDevicesPage),
          },
          {
            path: 'keys',
            loadComponent: () => import('@pages/admin-keys').then((m) => m.AdminKeysPage),
          },
          {
            path: 'logs',
            loadComponent: () => import('@pages/admin-logs').then((m) => m.AdminLogsPage),
          },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];

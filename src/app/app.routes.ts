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
            path: 'activity',
            loadComponent: () =>
              import('@pages/admin-activity').then((m) => m.AdminActivityPage),
          },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];

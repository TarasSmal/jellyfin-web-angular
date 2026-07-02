import { Routes } from '@angular/router';
import { authGuard, connectedGuard } from '@features/auth';

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
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('@pages/home').then((m) => m.HomePage),
  },
  { path: '**', redirectTo: '' },
];

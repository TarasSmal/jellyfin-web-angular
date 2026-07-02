import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ApiConfig } from '@shared/api';
import { SessionStore } from '@entities/user';

/** Redirects to /connect until a server URL is configured. */
export const connectedGuard: CanActivateFn = () => {
  const config = inject(ApiConfig);
  return config.isConnected() ? true : inject(Router).createUrlTree(['/connect']);
};

/** Redirects to /login until a session token exists. */
export const authGuard: CanActivateFn = () => {
  const config = inject(ApiConfig);
  if (!config.isConnected()) return inject(Router).createUrlTree(['/connect']);
  return config.isAuthenticated() ? true : inject(Router).createUrlTree(['/login']);
};

/**
 * Admin-only routes. The profile is restored before the first navigation
 * (app initializer), so isAdmin() is reliable here; non-admins land on home.
 */
export const adminGuard: CanActivateFn = () => {
  const config = inject(ApiConfig);
  if (!config.isConnected()) return inject(Router).createUrlTree(['/connect']);
  if (!config.isAuthenticated()) return inject(Router).createUrlTree(['/login']);
  return inject(SessionStore).isAdmin() ? true : inject(Router).createUrlTree(['/']);
};

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ApiConfig } from '@shared/api';

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

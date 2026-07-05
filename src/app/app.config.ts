import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideEnvironmentInitializer,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { NOTIFIER, installServerPreconnect, jellyfinAuthInterceptor } from '@shared/api';
import { ToastService } from '@shared/ui/toast';
import { AuthService } from '@features/auth';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([jellyfinAuthInterceptor])),
    provideRouter(routes, withComponentInputBinding()),
    // Live Resource mutations notify through this port; ToastService
    // satisfies it structurally.
    { provide: NOTIFIER, useExisting: ToastService },
    // Warm the connection to the (cross-origin, user-configured) Jellyfin
    // server so the first image doesn't pay DNS + TLS setup.
    provideEnvironmentInitializer(installServerPreconnect),
    // Validate a persisted token before the first route renders, so guards
    // never let a stale session through.
    provideAppInitializer(() =>
      inject(AuthService)
        .restoreSession()
        .then(() => undefined),
    ),
  ],
};

import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { jellyfinAuthInterceptor } from '@shared/api';
import { AuthService } from '@features/auth';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([jellyfinAuthInterceptor])),
    provideRouter(routes, withComponentInputBinding()),
    // Validate a persisted token before the first route renders, so guards
    // never let a stale session through.
    provideAppInitializer(() => inject(AuthService).restoreSession().then(() => undefined)),
  ],
};

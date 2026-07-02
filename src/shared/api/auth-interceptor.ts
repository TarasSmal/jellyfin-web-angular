import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { ApiConfig } from './api-config';
import { buildAuthHeader } from './auth-header';

/** Attaches the MediaBrowser authorization header to requests aimed at the configured server. */
export const jellyfinAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const config = inject(ApiConfig);
  const server = config.serverUrl();
  if (server && req.url.startsWith(server)) {
    req = req.clone({
      setHeaders: { Authorization: buildAuthHeader(config.accessToken()) },
    });
  }
  return next(req);
};

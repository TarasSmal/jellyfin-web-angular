import { DOCUMENT, effect, inject } from '@angular/core';

import { ApiConfig } from './api-config';

/**
 * Keep `<link rel="preconnect">` hints in `<head>` pointed at the configured
 * Jellyfin server. The server is a user-supplied, usually cross-origin URL, so
 * the hint cannot be baked into index.html; without it the first poster pays
 * full DNS + TCP + TLS setup. Two links are needed because `<img>` loads use
 * the no-CORS connection pool while HttpClient uses the CORS one.
 *
 * Wire via `provideEnvironmentInitializer(installServerPreconnect)`.
 */
function serverOrigin(server: string): string | null {
  try {
    return new URL(server).origin;
  } catch {
    return null;
  }
}

export function installServerPreconnect(): void {
  const config = inject(ApiConfig);
  const doc = inject(DOCUMENT);

  effect(() => {
    const server = config.serverUrl();
    for (const stale of doc.head.querySelectorAll('link[data-jf-preconnect]')) stale.remove();
    if (!server || serverOrigin(server) === doc.location.origin) return;
    for (const crossOrigin of [null, 'anonymous'] as const) {
      const link = doc.createElement('link');
      link.rel = 'preconnect';
      link.href = server;
      if (crossOrigin) link.crossOrigin = crossOrigin;
      link.setAttribute('data-jf-preconnect', '');
      doc.head.appendChild(link);
    }
  });
}

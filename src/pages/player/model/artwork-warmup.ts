import { effect, inject } from '@angular/core';
import { ApiConfig, BaseItemDto } from '@shared/api';
import { itemThumbUrl } from '@entities/item';

/**
 * Warm the queued episode's card thumbnail while the current one plays, so the
 * Up Next card renders complete even on slow connections. An off-screen image
 * fetch — the browser cache does the rest. Must be called in an injection
 * context.
 */
export function createArtworkWarmup(next: () => BaseItemDto | undefined): void {
  const config = inject(ApiConfig);
  // Adjacency refetches re-deliver the same neighbor as a fresh object; the
  // URL is the identity that matters for the cache.
  let warmed: string | null = null;
  effect(() => {
    const target = next();
    const url = target ? itemThumbUrl(config, target) : null;
    if (!url || url === warmed) return;
    warmed = url;
    new Image().src = url;
  });
}

import { ApiConfig, BaseItemDto } from '@shared/api';

// WebP encodes ~30% smaller than JPEG at the same visual quality and keeps
// logo transparency; Jellyfin has encoded it since 10.7.
function imageUrl(
  config: ApiConfig,
  itemId: string,
  type: 'Primary' | 'Backdrop/0' | 'Thumb' | 'Logo',
  tag: string,
  sizeParam: string,
  quality = 90,
): string {
  return `${config.url(`/Items/${itemId}/Images/${type}`)}?tag=${tag}&${sizeParam}&quality=${quality}&format=Webp`;
}

/** Full-screen backdrops are the heaviest images; q80 WebP is visually clean. */
const BACKDROP_QUALITY = 80;

/** 2:3 poster. Episodes fall back to their series poster. */
export function itemPosterUrl(config: ApiConfig, item: BaseItemDto, height = 480): string | null {
  const tag = item.ImageTags?.['Primary'];
  if (tag) return imageUrl(config, item.Id, 'Primary', tag, `fillHeight=${height}`);
  if (item.SeriesId && item.SeriesPrimaryImageTag) {
    return imageUrl(
      config,
      item.SeriesId,
      'Primary',
      item.SeriesPrimaryImageTag,
      `fillHeight=${height}`,
    );
  }
  return null;
}

/** 16:9 backdrop. Episodes/seasons fall back to the parent series backdrop. */
export function itemBackdropUrl(config: ApiConfig, item: BaseItemDto, width = 1920): string | null {
  const tag = item.BackdropImageTags?.[0];
  if (tag) {
    return imageUrl(config, item.Id, 'Backdrop/0', tag, `fillWidth=${width}`, BACKDROP_QUALITY);
  }
  const parentTag = item.ParentBackdropImageTags?.[0];
  if (item.ParentBackdropItemId && parentTag) {
    return imageUrl(
      config,
      item.ParentBackdropItemId,
      'Backdrop/0',
      parentTag,
      `fillWidth=${width}`,
      BACKDROP_QUALITY,
    );
  }
  return null;
}

/** Transparent title-treatment logo. Episodes/seasons fall back to the series logo. */
export function itemLogoUrl(config: ApiConfig, item: BaseItemDto, width = 800): string | null {
  const tag = item.ImageTags?.['Logo'];
  if (tag) return imageUrl(config, item.Id, 'Logo', tag, `maxWidth=${width}`);
  if (item.ParentLogoItemId && item.ParentLogoImageTag) {
    return imageUrl(config, item.ParentLogoItemId, 'Logo', item.ParentLogoImageTag, `maxWidth=${width}`);
  }
  return null;
}

/** Cast headshot. */
export function personImageUrl(
  config: ApiConfig,
  person: { Id: string; PrimaryImageTag?: string },
  height = 300,
): string | null {
  if (!person.PrimaryImageTag) return null;
  return imageUrl(config, person.Id, 'Primary', person.PrimaryImageTag, `fillHeight=${height}`);
}

/**
 * Studio/network logo by name. By-name images have no tag, so no cache-busting
 * (deliberate: the endpoint exposes none; the server's ETag still revalidates,
 * we only lose `immutable` and go stale-while-revalidate after a logo change).
 */
export function studioImageUrl(config: ApiConfig, name: string, maxHeight = 96): string {
  return `${config.url(`/Studios/${encodeURIComponent(name)}/Images/Primary`)}?maxHeight=${maxHeight}&quality=90&format=Webp`;
}

/** Cards render at fixed CSS sizes, so DPR descriptors (1x/2x) suffice. */
export function itemPosterSrcset(config: ApiConfig, item: BaseItemDto, height = 480): string | null {
  const x1 = itemPosterUrl(config, item, height);
  const x2 = itemPosterUrl(config, item, height * 2);
  return x1 && x2 ? `${x1} 1x, ${x2} 2x` : null;
}

/** DPR variants of the wide thumb (see `itemThumbUrl` for the fallback chain). */
export function itemThumbSrcset(config: ApiConfig, item: BaseItemDto, width = 640): string | null {
  const x1 = itemThumbUrl(config, item, width);
  const x2 = itemThumbUrl(config, item, width * 2);
  return x1 && x2 ? `${x1} 1x, ${x2} 2x` : null;
}

// Capped at 2560: a 2x full-screen hero; larger only burns bandwidth.
const BACKDROP_WIDTHS = [1280, 1920, 2560];

/** Width descriptors for the full-bleed hero; pair with sizes="100vw". */
export function itemBackdropSrcset(config: ApiConfig, item: BaseItemDto): string | null {
  const first = itemBackdropUrl(config, item, BACKDROP_WIDTHS[0]);
  if (!first) return null;
  return BACKDROP_WIDTHS.map((w) => `${itemBackdropUrl(config, item, w)} ${w}w`).join(', ');
}

// BlurHash lookups mirror the tag-fallback logic of the URL builders above.
// The server merges parent/series image hashes into the item's own
// ImageBlurHashes dict, keyed by tag, so one dict lookup covers the fallbacks.
function hashFor(
  item: BaseItemDto,
  type: 'Primary' | 'Backdrop' | 'Thumb',
  tag: string | undefined,
): string | null {
  return (tag && item.ImageBlurHashes?.[type]?.[tag]) || null;
}

/** Placeholder for the image `itemPosterUrl` resolves to. */
export function itemPosterHash(item: BaseItemDto): string | null {
  const tag =
    item.ImageTags?.['Primary'] ?? (item.SeriesId ? item.SeriesPrimaryImageTag : undefined);
  return hashFor(item, 'Primary', tag);
}

/** Placeholder for the image `itemBackdropUrl` resolves to. */
export function itemBackdropHash(item: BaseItemDto): string | null {
  const tag =
    item.BackdropImageTags?.[0] ??
    (item.ParentBackdropItemId ? item.ParentBackdropImageTags?.[0] : undefined);
  return hashFor(item, 'Backdrop', tag);
}

/** Placeholder for the image `itemThumbUrl` resolves to. */
export function itemThumbHash(item: BaseItemDto): string | null {
  const thumbTag = item.ImageTags?.['Thumb'];
  if (thumbTag) return hashFor(item, 'Thumb', thumbTag);
  const primaryTag = item.ImageTags?.['Primary'];
  if (item.Type === 'Episode' && primaryTag) return hashFor(item, 'Primary', primaryTag);
  return itemBackdropHash(item);
}

/** Wide card image for Continue Watching / Next Up: own thumb, else episode still, else backdrop. */
export function itemThumbUrl(config: ApiConfig, item: BaseItemDto, width = 640): string | null {
  const thumbTag = item.ImageTags?.['Thumb'];
  if (thumbTag) return imageUrl(config, item.Id, 'Thumb', thumbTag, `fillWidth=${width}`);
  const primaryTag = item.ImageTags?.['Primary'];
  if (item.Type === 'Episode' && primaryTag) {
    return imageUrl(config, item.Id, 'Primary', primaryTag, `fillWidth=${width}`);
  }
  return itemBackdropUrl(config, item, width);
}

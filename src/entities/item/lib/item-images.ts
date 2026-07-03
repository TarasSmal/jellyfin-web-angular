import { ApiConfig, BaseItemDto } from '@shared/api';

function imageUrl(
  config: ApiConfig,
  itemId: string,
  type: 'Primary' | 'Backdrop/0' | 'Thumb',
  tag: string,
  sizeParam: string,
): string {
  return `${config.url(`/Items/${itemId}/Images/${type}`)}?tag=${tag}&${sizeParam}&quality=90`;
}

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
  if (tag) return imageUrl(config, item.Id, 'Backdrop/0', tag, `fillWidth=${width}`);
  const parentTag = item.ParentBackdropImageTags?.[0];
  if (item.ParentBackdropItemId && parentTag) {
    return imageUrl(
      config,
      item.ParentBackdropItemId,
      'Backdrop/0',
      parentTag,
      `fillWidth=${width}`,
    );
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

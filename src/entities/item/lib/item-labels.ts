import { BaseItemDto } from '@shared/api';

/** "S2:E5" for episodes. */
export function episodeCode(item: BaseItemDto): string | null {
  if (item.Type !== 'Episode') return null;
  const season = item.ParentIndexNumber;
  const episode = item.IndexNumber;
  if (season == null || episode == null) return null;
  return `S${season}:E${episode}`;
}

/** Card title: episodes and seasons are titled by their series. */
export function cardTitle(item: BaseItemDto): string {
  const isChildOfSeries = item.Type === 'Episode' || item.Type === 'Season';
  return isChildOfSeries && item.SeriesName ? item.SeriesName : item.Name;
}

/** Card subtitle: episode code + name, season name, or production year. */
export function cardSubtitle(item: BaseItemDto): string | null {
  if (item.Type === 'Episode') {
    const code = episodeCode(item);
    return code ? `${code} · ${item.Name}` : item.Name;
  }
  if (item.Type === 'Season' && item.SeriesName) return item.Name;
  return item.ProductionYear?.toString() ?? null;
}

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

/** "92%" (critic) else "★ 7.8" (community) else null. */
export function ratingLabel(item: BaseItemDto): string | null {
  if (item.CriticRating != null) return `${Math.round(item.CriticRating)}%`;
  if (item.CommunityRating != null) return `★ ${item.CommunityRating.toFixed(1)}`;
  return null;
}

/** Card overlay meta line: episodes/seasons keep their subtitle; movies/series get "2024 · 92%". */
export function cardMeta(item: BaseItemDto): string | null {
  const subtitle = cardSubtitle(item);
  if (item.Type === 'Episode' || item.Type === 'Season') return subtitle;
  const rating = ratingLabel(item);
  return [subtitle, rating].filter(Boolean).join(' · ') || null;
}

/** Badge studio: episodes carry SeriesStudio; everything else uses the first studio. */
export function studioName(item: BaseItemDto): string | null {
  return item.SeriesStudio ?? item.Studios?.[0]?.Name ?? null;
}

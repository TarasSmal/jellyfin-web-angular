import { BaseItemDto } from '@shared/api';
import { cardSubtitle } from '@entities/item';

/** Controls-bar hint for the queued episode: "Next: S2:E6 · Title". */
export function nextEpisodeHint(next: BaseItemDto | undefined): string | null {
  if (!next) return null;
  return `Next: ${cardSubtitle(next) ?? next.Name}`;
}

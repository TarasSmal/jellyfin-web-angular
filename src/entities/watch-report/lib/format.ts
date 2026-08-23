import { TICKS_PER_MS } from '@shared/lib/ticks';

const MS_PER_HOUR = 3_600_000;
const MS_PER_MINUTE = 60_000;

/**
 * Watch time for a dashboard, where totals span minutes to months.
 * `formatRuntime` stays the right tool for a single title's length; this one
 * degrades to whole hours before "347h 12m" stops meaning anything.
 */
export function formatWatchTime(ticks: number): string {
  if (!Number.isFinite(ticks) || ticks <= 0) return '0m';
  const ms = ticks / TICKS_PER_MS;
  const hours = Math.floor(ms / MS_PER_HOUR);
  const minutes = Math.round((ms % MS_PER_HOUR) / MS_PER_MINUTE);
  if (hours === 0) return `${Math.max(minutes, 1)}m`;
  if (hours < 48) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${groupThousands(hours)}h`;
}

/** Days-and-hours phrasing, for the one headline tile where scale is the point. */
export function formatWatchSpan(ticks: number): string {
  const hours = Math.floor(ticks / TICKS_PER_MS / MS_PER_HOUR);
  if (hours < 24) return formatWatchTime(ticks);
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  return rest > 0 ? `${groupThousands(days)}d ${rest}h` : `${groupThousands(days)}d`;
}

/** "12,480" — hand-rolled so counts render identically in every locale. */
export function groupThousands(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** "38%" — shares arrive as 0–1 fractions. */
export function formatShare(share: number): string {
  if (!Number.isFinite(share) || share <= 0) return '0%';
  return `${Math.round(share * 100)}%`;
}

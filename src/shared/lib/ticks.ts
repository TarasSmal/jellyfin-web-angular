/** Jellyfin measures time in .NET ticks: 10,000 ticks per millisecond. */
export const TICKS_PER_MS = 10_000;
export const TICKS_PER_SECOND = TICKS_PER_MS * 1000;

export function ticksToSeconds(ticks: number): number {
  return ticks / TICKS_PER_SECOND;
}

export function secondsToTicks(seconds: number): number {
  return Math.round(seconds * TICKS_PER_SECOND);
}

/** "2h 14m" for runtimes; minutes-only under an hour. */
export function formatRuntime(ticks: number): string {
  const totalMinutes = Math.round(ticks / TICKS_PER_MS / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

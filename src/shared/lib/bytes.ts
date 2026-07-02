/** "1.4 TB" / "820 GB" — binary-ish display with one decimal above GB. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit++;
  }
  return `${value >= 100 || unit < 3 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

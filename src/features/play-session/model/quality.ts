import { MediaSourceInfo } from '@shared/api';

/** A selectable bitrate cap. `null` never appears here — Auto is the absence of a cap. */
export interface QualityOption {
  bitrate: number;
  label: string;
}

const STORAGE_KEY = 'jf.maxStreamingBitrate';

/**
 * The jellyfin-web quality ladder. A tier is offered when the source video is
 * at least `minHeight` tall — thresholds sit below the nominal resolutions so
 * off-spec sources (1000p rips, anamorphic 800p) still see their tier.
 */
const TIERS: { minHeight: number; option: QualityOption }[] = [
  { minHeight: 2100, option: { bitrate: 120_000_000, label: '4K - 120 Mbps' } },
  { minHeight: 2100, option: { bitrate: 80_000_000, label: '4K - 80 Mbps' } },
  { minHeight: 1000, option: { bitrate: 60_000_000, label: '1080p - 60 Mbps' } },
  { minHeight: 1000, option: { bitrate: 40_000_000, label: '1080p - 40 Mbps' } },
  { minHeight: 1000, option: { bitrate: 20_000_000, label: '1080p - 20 Mbps' } },
  { minHeight: 1000, option: { bitrate: 10_000_000, label: '1080p - 10 Mbps' } },
  { minHeight: 700, option: { bitrate: 8_000_000, label: '720p - 8 Mbps' } },
  { minHeight: 700, option: { bitrate: 6_000_000, label: '720p - 6 Mbps' } },
  { minHeight: 700, option: { bitrate: 4_000_000, label: '720p - 4 Mbps' } },
  { minHeight: 400, option: { bitrate: 3_000_000, label: '480p - 3 Mbps' } },
  { minHeight: 400, option: { bitrate: 1_500_000, label: '480p - 1.5 Mbps' } },
  { minHeight: 0, option: { bitrate: 420_000, label: '360p - 420 kbps' } },
];

/**
 * The tiers worth offering for one source: nothing above the video's own
 * resolution (a 720p file gains nothing from a 4K cap — Auto already plays it
 * whole). Unknown resolution offers the full ladder.
 */
export function qualityOptionsFor(source: MediaSourceInfo | null): QualityOption[] {
  const height = source?.MediaStreams?.find((s) => s.Type === 'Video')?.Height;
  if (!height) return TIERS.map((t) => t.option);
  return TIERS.filter((t) => t.minHeight <= height).map((t) => t.option);
}

/** The saved cap in bps, or null for Auto. Storage failures read as Auto. */
export function loadMaxBitrate(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const value = raw === null ? NaN : Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

/** Persist the cap across sessions; Auto (null) clears it. Best-effort. */
export function saveMaxBitrate(bitrate: number | null): void {
  try {
    if (bitrate === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(bitrate));
  } catch {
    // storage unavailable — the selection still applies for this session
  }
}

import { MediaSourceInfo } from '@shared/api';
import { loadMaxBitrate, qualityOptionsFor, saveMaxBitrate } from './quality';

function sourceWithHeight(height?: number): MediaSourceInfo {
  return {
    Id: 'src',
    MediaStreams: [
      { Index: 0, Type: 'Video', Height: height },
      { Index: 1, Type: 'Audio' },
    ],
  };
}

describe('qualityOptionsFor', () => {
  it('offers nothing above the source resolution', () => {
    const labels = qualityOptionsFor(sourceWithHeight(1080)).map((o) => o.label);
    expect(labels[0]).toBe('1080p - 60 Mbps');
    expect(labels).not.toContain('4K - 120 Mbps');
    expect(labels).toContain('360p - 420 kbps');
  });

  it('offers the full ladder for a 4K source', () => {
    const labels = qualityOptionsFor(sourceWithHeight(2160)).map((o) => o.label);
    expect(labels[0]).toBe('4K - 120 Mbps');
    expect(labels).toHaveLength(12);
  });

  it('keeps a tier for slightly off-spec heights', () => {
    const labels = qualityOptionsFor(sourceWithHeight(1040)).map((o) => o.label);
    expect(labels[0]).toBe('1080p - 60 Mbps');
  });

  it('offers the full ladder when the resolution is unknown', () => {
    expect(qualityOptionsFor(sourceWithHeight(undefined))).toHaveLength(12);
    expect(qualityOptionsFor(null)).toHaveLength(12);
  });

  it('orders options highest first', () => {
    const bitrates = qualityOptionsFor(null).map((o) => o.bitrate);
    expect(bitrates).toEqual([...bitrates].sort((a, b) => b - a));
  });
});

describe('bitrate persistence', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a saved cap', () => {
    saveMaxBitrate(4_000_000);
    expect(loadMaxBitrate()).toBe(4_000_000);
  });

  it('reads Auto when nothing is saved', () => {
    expect(loadMaxBitrate()).toBeNull();
  });

  it('clears the cap when Auto is saved', () => {
    saveMaxBitrate(4_000_000);
    saveMaxBitrate(null);
    expect(loadMaxBitrate()).toBeNull();
  });

  it('reads garbage as Auto', () => {
    localStorage.setItem('jf.maxStreamingBitrate', 'not-a-number');
    expect(loadMaxBitrate()).toBeNull();
  });
});

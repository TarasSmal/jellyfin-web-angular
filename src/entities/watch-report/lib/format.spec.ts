import { describe, expect, it } from 'vitest';
import { formatShare, formatWatchSpan, formatWatchTime, groupThousands } from './format';

const HOUR = 36_000_000_000;

describe('formatWatchTime', () => {
  it('shows minutes under an hour', () => {
    expect(formatWatchTime(HOUR * 0.75)).toBe('45m');
  });

  it('never rounds a real viewing down to nothing', () => {
    expect(formatWatchTime(HOUR / 600)).toBe('1m');
  });

  it('shows hours and minutes up to two days', () => {
    expect(formatWatchTime(HOUR * 12.5)).toBe('12h 30m');
    expect(formatWatchTime(HOUR * 12)).toBe('12h');
  });

  it('drops to whole grouped hours once the minutes stop mattering', () => {
    expect(formatWatchTime(HOUR * 1240.4)).toBe('1,240h');
  });

  it('reads zero for nothing watched', () => {
    expect(formatWatchTime(0)).toBe('0m');
    expect(formatWatchTime(Number.NaN)).toBe('0m');
  });
});

describe('formatWatchSpan', () => {
  it('keeps sub-day totals in hours', () => {
    expect(formatWatchSpan(HOUR * 5)).toBe('5h');
  });

  it('switches to days and hours at scale', () => {
    expect(formatWatchSpan(HOUR * 51.7)).toBe('2d 3h');
    expect(formatWatchSpan(HOUR * 48)).toBe('2d');
  });
});

describe('groupThousands', () => {
  it('groups from four digits up', () => {
    expect(groupThousands(999)).toBe('999');
    expect(groupThousands(12480)).toBe('12,480');
    expect(groupThousands(1234567)).toBe('1,234,567');
  });
});

describe('formatShare', () => {
  it('renders a fraction as whole percent', () => {
    expect(formatShare(0.384)).toBe('38%');
    expect(formatShare(0)).toBe('0%');
  });
});

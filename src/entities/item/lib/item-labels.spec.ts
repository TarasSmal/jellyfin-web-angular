import { describe, expect, it } from 'vitest';
import { BaseItemDto } from '@shared/api';
import { cardMeta, ratingLabel, studioName } from './item-labels';

const movie = (overrides: Partial<BaseItemDto> = {}): BaseItemDto => ({
  Id: 'm1',
  Name: 'The Copenhagen Test',
  Type: 'Movie',
  ...overrides,
});

describe('ratingLabel', () => {
  it('prefers the critic rating as a rounded percentage', () => {
    expect(ratingLabel(movie({ CriticRating: 74.6, CommunityRating: 7.8 }))).toBe('75%');
  });

  it('falls back to the community rating with one decimal', () => {
    expect(ratingLabel(movie({ CommunityRating: 7.849 }))).toBe('★ 7.8');
    expect(ratingLabel(movie({ CommunityRating: 8 }))).toBe('★ 8.0');
  });

  it('returns null when neither rating exists', () => {
    expect(ratingLabel(movie())).toBeNull();
  });
});

describe('cardMeta', () => {
  it('joins year and rating for movies', () => {
    expect(cardMeta(movie({ ProductionYear: 2024, CriticRating: 92 }))).toBe('2024 · 92%');
  });

  it('shows year alone when no rating exists', () => {
    expect(cardMeta(movie({ ProductionYear: 2024 }))).toBe('2024');
  });

  it('shows rating alone when no year exists', () => {
    expect(cardMeta(movie({ CommunityRating: 7.8 }))).toBe('★ 7.8');
  });

  it('returns null when nothing is available', () => {
    expect(cardMeta(movie())).toBeNull();
  });

  it('keeps the episode subtitle without ratings', () => {
    const episode = movie({
      Type: 'Episode',
      Name: 'Pilot',
      SeriesName: 'Misfits',
      ParentIndexNumber: 2,
      IndexNumber: 5,
      CommunityRating: 9.1,
    });
    expect(cardMeta(episode)).toBe('S2:E5 · Pilot');
  });

  it('keeps the season name without ratings', () => {
    const season = movie({
      Type: 'Season',
      Name: 'Season 2',
      SeriesName: 'Misfits',
      CommunityRating: 9.1,
    });
    expect(cardMeta(season)).toBe('Season 2');
  });
});

describe('studioName', () => {
  it('prefers SeriesStudio on episodes', () => {
    const episode = movie({
      Type: 'Episode',
      SeriesStudio: 'NBC',
      Studios: [{ Id: 's1', Name: 'Universal' }],
    });
    expect(studioName(episode)).toBe('NBC');
  });

  it('uses the first studio otherwise', () => {
    expect(studioName(movie({ Studios: [{ Id: 's1', Name: 'A24' }] }))).toBe('A24');
  });

  it('returns null for an empty studio list', () => {
    expect(studioName(movie({ Studios: [] }))).toBeNull();
  });

  it('returns null when no studio data exists', () => {
    expect(studioName(movie())).toBeNull();
  });
});

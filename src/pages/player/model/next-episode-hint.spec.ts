import { BaseItemDto } from '@shared/api';
import { nextEpisodeHint } from './next-episode-hint';

describe('nextEpisodeHint', () => {
  it('names the queued episode by code and title', () => {
    const next = {
      Id: 'ep-6',
      Name: 'The Bicameral Mind',
      Type: 'Episode',
      ParentIndexNumber: 2,
      IndexNumber: 6,
    } as BaseItemDto;

    expect(nextEpisodeHint(next)).toBe('Next: S2:E6 · The Bicameral Mind');
  });

  it('is absent when nothing is queued', () => {
    expect(nextEpisodeHint(undefined)).toBeNull();
  });

  it('falls back to the title alone when the episode has no code', () => {
    const next = { Id: 'ep-x', Name: 'Special', Type: 'Episode' } as BaseItemDto;
    expect(nextEpisodeHint(next)).toBe('Next: Special');
  });
});

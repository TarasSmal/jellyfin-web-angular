import { describe, expect, it } from 'vitest';
import { BaseItemDto } from '@shared/api';
import { UserPlayHistory } from '../model/types';
import { aggregateWatchStats } from './aggregate';

const HOUR_TICKS = 36_000_000_000;
const NOW = new Date(2026, 7, 23); // 23 Aug 2026

function movie(id: string, overrides: Partial<BaseItemDto> = {}): BaseItemDto {
  return {
    Id: id,
    Name: id,
    Type: 'Movie',
    RunTimeTicks: HOUR_TICKS,
    ...overrides,
  };
}

function episode(id: string, seriesId: string, overrides: Partial<BaseItemDto> = {}): BaseItemDto {
  return {
    Id: id,
    Name: id,
    Type: 'Episode',
    SeriesId: seriesId,
    SeriesName: seriesId,
    RunTimeTicks: HOUR_TICKS / 2,
    ...overrides,
  };
}

function history(
  userId: string,
  items: BaseItemDto[],
  truncated = false,
): UserPlayHistory {
  return { userId, userName: userId, items, truncated };
}

function aggregate(histories: UserPlayHistory[]) {
  return aggregateWatchStats(histories, { now: NOW });
}

describe('watch time', () => {
  it('estimates it as runtime times play count', () => {
    const stats = aggregate([
      history('ann', [movie('m1', { UserData: { PlayCount: 3 } })]),
    ]);

    expect(stats.totals.watchTimeTicks).toBe(HOUR_TICKS * 3);
    expect(stats.totals.plays).toBe(3);
  });

  it('counts a finished item with no play count as one viewing', () => {
    const stats = aggregate([history('ann', [movie('m1', { UserData: { Played: true } })])]);

    expect(stats.totals.plays).toBe(1);
    expect(stats.totals.watchTimeTicks).toBe(HOUR_TICKS);
  });

  it('ignores an item the server gave no runtime for', () => {
    const stats = aggregate([history('ann', [movie('m1', { RunTimeTicks: undefined })])]);

    expect(stats.totals.watchTimeTicks).toBe(0);
    expect(stats.totals.titles).toBe(1);
  });
});

describe('distinct titles', () => {
  it('counts a film watched by two accounts once, but both their plays', () => {
    const stats = aggregate([
      history('ann', [movie('m1', { UserData: { PlayCount: 1 } })]),
      history('bo', [movie('m1', { UserData: { PlayCount: 2 } })]),
    ]);

    expect(stats.totals.titles).toBe(1);
    expect(stats.totals.movies).toBe(1);
    expect(stats.totals.plays).toBe(3);
  });

  it('separates movies from episodes', () => {
    const stats = aggregate([history('ann', [movie('m1'), episode('e1', 's1')])]);

    expect(stats.totals.movies).toBe(1);
    expect(stats.totals.episodes).toBe(1);
  });
});

describe('accounts', () => {
  it('counts only accounts that finished something as active', () => {
    const stats = aggregate([history('ann', [movie('m1')]), history('bo', [])]);

    expect(stats.totals.accounts).toBe(2);
    expect(stats.totals.activeUsers).toBe(1);
  });

  it('ranks accounts by watch time, busiest first', () => {
    const stats = aggregate([
      history('ann', [movie('m1')]),
      history('bo', [movie('m2', { UserData: { PlayCount: 5 } })]),
    ]);

    expect(stats.users.map((user) => user.userName)).toEqual(['bo', 'ann']);
  });

  it('names each account its own most-watched genre', () => {
    const stats = aggregate([
      history('ann', [
        movie('m1', { Genres: ['Horror'] }),
        movie('m2', { Genres: ['Comedy'], UserData: { PlayCount: 4 } }),
      ]),
    ]);

    expect(stats.users[0].topGenre).toBe('Comedy');
  });

  it('reports the latest finish and its title, not merely the first row', () => {
    const stats = aggregate([
      history('ann', [
        movie('m1', { UserData: { LastPlayedDate: '2026-03-01T10:00:00Z' } }),
        episode('e1', 'Fringe', {
          Name: 'Pilot',
          SeriesName: 'Fringe',
          UserData: { LastPlayedDate: '2026-08-01T10:00:00Z' },
        }),
      ]),
    ]);

    expect(stats.users[0].lastPlayed).toBe('2026-08-01T10:00:00Z');
    expect(stats.users[0].lastPlayedName).toBe('Fringe — Pilot');
  });
});

describe('rankings', () => {
  it('ranks genres by watch time and shares them against every genre', () => {
    const stats = aggregate([
      history('ann', [
        movie('m1', { Genres: ['Drama'], UserData: { PlayCount: 3 } }),
        movie('m2', { Genres: ['Drama'] }),
        movie('m3', { Genres: ['Comedy'] }),
      ]),
    ]);

    expect(stats.topGenres[0]).toMatchObject({ label: 'Drama', titles: 2, share: 0.8 });
    expect(stats.topGenres[1]).toMatchObject({ label: 'Comedy', titles: 1 });
  });

  it('credits an episode to its series network when it has no studio', () => {
    const stats = aggregate([history('ann', [episode('e1', 's1', { SeriesStudio: 'AMC' })])]);

    expect(stats.topStudios[0].label).toBe('AMC');
  });

  it('prefers an item its own studio over the series fallback', () => {
    const stats = aggregate([
      history('ann', [episode('e1', 's1', { Studios: [{ Id: 'x', Name: 'HBO' }], SeriesStudio: 'AMC' })]),
    ]);

    expect(stats.topStudios.map((studio) => studio.label)).toEqual(['HBO']);
  });

  it('rolls episodes up into their series with a viewer count', () => {
    const stats = aggregate([
      history('ann', [episode('e1', 'Severance'), episode('e2', 'Severance')]),
      history('bo', [episode('e1', 'Severance')]),
    ]);

    expect(stats.topSeries[0]).toMatchObject({ name: 'Severance', episodes: 2, viewers: 2, plays: 3 });
  });

  it('ranks films by reach before rewatches', () => {
    const stats = aggregate([
      history('ann', [movie('cult', { UserData: { PlayCount: 9 } }), movie('hit')]),
      history('bo', [movie('hit')]),
    ]);

    expect(stats.topMovies[0]).toMatchObject({ name: 'hit', viewers: 2 });
  });

  it('keeps rankings to the requested size', () => {
    const items = Array.from({ length: 12 }, (_, i) => movie(`m${i}`, { Genres: [`g${i}`] }));
    const stats = aggregateWatchStats([history('ann', items)], { now: NOW, topN: 3 });

    expect(stats.topGenres).toHaveLength(3);
  });
});

describe('decades', () => {
  it('buckets release years into decades, oldest first', () => {
    const stats = aggregate([
      history('ann', [
        movie('m1', { ProductionYear: 1994 }),
        movie('m2', { ProductionYear: 1999 }),
        movie('m3', { ProductionYear: 2024 }),
      ]),
    ]);

    expect(stats.decades.map((d) => d.label)).toEqual(['1990s', '2020s']);
    expect(stats.decades[0].titles).toBe(2);
  });

  it('skips items with no release year', () => {
    const stats = aggregate([history('ann', [movie('m1')])]);

    expect(stats.decades).toEqual([]);
  });
});

describe('activity', () => {
  it('spans the trailing window, zero-filling quiet months', () => {
    const stats = aggregateWatchStats(
      [history('ann', [movie('m1', { UserData: { LastPlayedDate: '2026-08-04T12:00:00Z' } })])],
      { now: NOW, months: 3 },
    );

    expect(stats.activity.map((month) => month.key)).toEqual(['2026-06', '2026-07', '2026-08']);
    expect(stats.activity.map((month) => month.titles)).toEqual([0, 0, 1]);
    expect(stats.activity[2].label).toBe('Aug 2026');
  });

  it('counts each account separately when both finished the same title', () => {
    const played = { LastPlayedDate: '2026-08-04T12:00:00Z' };
    const stats = aggregateWatchStats(
      [history('ann', [movie('m1', { UserData: played })]), history('bo', [movie('m1', { UserData: played })])],
      { now: NOW, months: 1 },
    );

    expect(stats.activity[0].titles).toBe(2);
  });

  it('drops finishes older than the window', () => {
    const stats = aggregateWatchStats(
      [history('ann', [movie('m1', { UserData: { LastPlayedDate: '2019-01-04T12:00:00Z' } })])],
      { now: NOW, months: 3 },
    );

    expect(stats.activity.every((month) => month.titles === 0)).toBe(true);
  });
});

describe('taste rating', () => {
  it('averages the community rating of each distinct title', () => {
    const stats = aggregate([
      history('ann', [movie('m1', { CommunityRating: 8 }), movie('m2', { CommunityRating: 7 })]),
      history('bo', [movie('m1', { CommunityRating: 8 })]),
    ]);

    expect(stats.tasteRating).toBe(7.5);
  });

  it('is null when nothing watched carries a rating', () => {
    expect(aggregate([history('ann', [movie('m1')])]).tasteRating).toBeNull();
  });
});

describe('truncation', () => {
  it('flags the report when any account outgrew one read', () => {
    const stats = aggregate([history('ann', [movie('m1')], true), history('bo', [movie('m2')])]);

    expect(stats.truncated).toBe(true);
    expect(stats.users.find((user) => user.userName === 'ann')?.truncated).toBe(true);
    expect(stats.users.find((user) => user.userName === 'bo')?.truncated).toBe(false);
  });
});

describe('empty server', () => {
  it('produces a zeroed report rather than throwing', () => {
    const stats = aggregate([]);

    expect(stats.totals).toMatchObject({ watchTimeTicks: 0, titles: 0, accounts: 0 });
    expect(stats.topGenres).toEqual([]);
    expect(stats.activity).toHaveLength(12);
  });
});

import { BaseItemDto } from '@shared/api';
import {
  ActivityMonth,
  MovieWatchStats,
  RankedEntry,
  SeriesWatchStats,
  ServerWatchStats,
  UserPlayHistory,
  UserWatchStats,
} from '../model/types';

/**
 * Folds every account's finished items into one server-wide report.
 *
 * Watch time is an *estimate*: runtime × play count. Jellyfin stores no
 * duration per viewing, so an abandoned-at-95% film counts as a whole film
 * and a title watched twice counts twice. Good enough to rank genres and
 * compare accounts; not an audit trail. See ADR 0006.
 *
 * Pure by design — `now` is a parameter so the activity window is testable.
 */
export function aggregateWatchStats(
  histories: readonly UserPlayHistory[],
  options: AggregateOptions,
): ServerWatchStats {
  const { now, months = ACTIVITY_MONTHS, topN = TOP_N } = options;

  const genres = new Bucket();
  const studios = new Bucket();
  const decades = new Bucket();
  const series = new Map<string, SeriesAccumulator>();
  const movies = new Map<string, MovieAccumulator>();
  const finishesByMonth = new Map<string, number>();
  const watchedIds = new Set<string>();
  const watchedMovieIds = new Set<string>();
  const watchedEpisodeIds = new Set<string>();
  const ratings: number[] = [];

  let totalTicks = 0;
  let totalPlays = 0;
  let activeUsers = 0;
  let truncated = false;

  const users: UserWatchStats[] = [];

  for (const history of histories) {
    const userGenres = new Bucket();
    let userTicks = 0;
    let userPlays = 0;
    const userMovies = new Set<string>();
    const userEpisodes = new Set<string>();
    let lastPlayed: string | null = null;
    let lastPlayedName: string | null = null;

    for (const item of history.items) {
      const plays = playCount(item);
      const ticks = (item.RunTimeTicks ?? 0) * plays;

      userTicks += ticks;
      userPlays += plays;
      totalTicks += ticks;
      totalPlays += plays;

      // Distinct-title sets are keyed by item id, so two accounts watching the
      // same film add two plays but only one title.
      const firstSighting = !watchedIds.has(item.Id);
      watchedIds.add(item.Id);
      if (firstSighting && item.CommunityRating != null) ratings.push(item.CommunityRating);

      if (item.Type === 'Episode') {
        userEpisodes.add(item.Id);
        watchedEpisodeIds.add(item.Id);
      } else {
        userMovies.add(item.Id);
        watchedMovieIds.add(item.Id);
      }

      for (const genre of item.Genres ?? []) {
        genres.add(genre, genre, ticks, item.Id);
        userGenres.add(genre, genre, ticks, item.Id);
      }
      for (const studio of studioNames(item)) studios.add(studio, studio, ticks, item.Id);

      const decade = decadeOf(item.ProductionYear);
      if (decade) decades.add(decade.key, decade.label, ticks, item.Id);

      accumulateSeries(series, item, history.userId, plays, ticks);
      accumulateMovie(movies, item, history.userId, plays, ticks);

      const month = monthKey(item.UserData?.LastPlayedDate);
      if (month) finishesByMonth.set(month, (finishesByMonth.get(month) ?? 0) + 1);

      // Items arrive newest finish first, but a server that ignores the sort
      // shouldn't corrupt the column — compare rather than take the first.
      const finishedAt = item.UserData?.LastPlayedDate;
      if (finishedAt && (lastPlayed === null || finishedAt > lastPlayed)) {
        lastPlayed = finishedAt;
        lastPlayedName = titleOf(item);
      }
    }

    if (history.items.length > 0) activeUsers++;
    if (history.truncated) truncated = true;

    users.push({
      userId: history.userId,
      userName: history.userName,
      watchTimeTicks: userTicks,
      plays: userPlays,
      movies: userMovies.size,
      episodes: userEpisodes.size,
      topGenre: userGenres.top()?.label ?? null,
      lastPlayed,
      lastPlayedName,
      truncated: history.truncated,
    });
  }

  users.sort((a, b) => b.watchTimeTicks - a.watchTimeTicks || a.userName.localeCompare(b.userName));

  return {
    totals: {
      watchTimeTicks: totalTicks,
      plays: totalPlays,
      titles: watchedIds.size,
      movies: watchedMovieIds.size,
      episodes: watchedEpisodeIds.size,
      activeUsers,
      accounts: histories.length,
    },
    users,
    topGenres: genres.rank(topN),
    topStudios: studios.rank(topN),
    topSeries: rankSeries(series, topN),
    topMovies: rankMovies(movies, topN),
    decades: decades.rank(Infinity).sort((a, b) => a.key.localeCompare(b.key)),
    activity: activityMonths(finishesByMonth, now, months),
    tasteRating: ratings.length ? round1(mean(ratings)) : null,
    truncated,
  };
}

export interface AggregateOptions {
  /** Anchors the activity window; injected so the fold stays pure. */
  now: Date;
  /** How many months the activity chart spans, ending with `now`'s month. */
  months?: number;
  /** How many entries each ranking keeps. */
  topN?: number;
}

const ACTIVITY_MONTHS = 12;
const TOP_N = 8;

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * A ranked tally: watch time summed, titles counted once each. The id set is
 * what keeps a film watched by four people from inflating the title count.
 */
class Bucket {
  private readonly entries = new Map<string, { label: string; ticks: number; ids: Set<string> }>();
  private total = 0;

  add(key: string, label: string, ticks: number, itemId: string): void {
    const entry = this.entries.get(key) ?? { label, ticks: 0, ids: new Set<string>() };
    entry.ticks += ticks;
    entry.ids.add(itemId);
    this.entries.set(key, entry);
    this.total += ticks;
  }

  top(): { label: string } | null {
    let best: { label: string; ticks: number } | null = null;
    for (const entry of this.entries.values()) {
      if (!best || entry.ticks > best.ticks) best = entry;
    }
    return best;
  }

  rank(limit: number): RankedEntry[] {
    const ranked = [...this.entries.entries()].map(([key, entry]) => ({
      key,
      label: entry.label,
      watchTimeTicks: entry.ticks,
      titles: entry.ids.size,
      share: this.total > 0 ? entry.ticks / this.total : 0,
    }));
    ranked.sort((a, b) => b.watchTimeTicks - a.watchTimeTicks || a.label.localeCompare(b.label));
    return Number.isFinite(limit) ? ranked.slice(0, limit) : ranked;
  }
}

interface SeriesAccumulator {
  name: string;
  episodes: Set<string>;
  viewers: Set<string>;
  plays: number;
  ticks: number;
}

interface MovieAccumulator {
  name: string;
  year: number | null;
  viewers: Set<string>;
  plays: number;
  ticks: number;
}

function accumulateSeries(
  series: Map<string, SeriesAccumulator>,
  item: BaseItemDto,
  userId: string,
  plays: number,
  ticks: number,
): void {
  if (item.Type !== 'Episode' || !item.SeriesId) return;
  const entry = series.get(item.SeriesId) ?? {
    name: item.SeriesName ?? 'Unknown series',
    episodes: new Set<string>(),
    viewers: new Set<string>(),
    plays: 0,
    ticks: 0,
  };
  entry.episodes.add(item.Id);
  entry.viewers.add(userId);
  entry.plays += plays;
  entry.ticks += ticks;
  series.set(item.SeriesId, entry);
}

function accumulateMovie(
  movies: Map<string, MovieAccumulator>,
  item: BaseItemDto,
  userId: string,
  plays: number,
  ticks: number,
): void {
  if (item.Type === 'Episode') return;
  const entry = movies.get(item.Id) ?? {
    name: item.Name,
    year: item.ProductionYear ?? null,
    viewers: new Set<string>(),
    plays: 0,
    ticks: 0,
  };
  entry.viewers.add(userId);
  entry.plays += plays;
  entry.ticks += ticks;
  movies.set(item.Id, entry);
}

/** Series rank by how much of them was watched, then by reach. */
function rankSeries(series: Map<string, SeriesAccumulator>, limit: number): SeriesWatchStats[] {
  return [...series.entries()]
    .map(([seriesId, entry]) => ({
      seriesId,
      name: entry.name,
      episodes: entry.episodes.size,
      plays: entry.plays,
      watchTimeTicks: entry.ticks,
      viewers: entry.viewers.size,
    }))
    .sort((a, b) => b.watchTimeTicks - a.watchTimeTicks || b.viewers - a.viewers)
    .slice(0, limit);
}

/** Films rank by reach first: four households beat one person's four rewatches. */
function rankMovies(movies: Map<string, MovieAccumulator>, limit: number): MovieWatchStats[] {
  return [...movies.entries()]
    .map(([itemId, entry]) => ({
      itemId,
      name: entry.name,
      year: entry.year,
      plays: entry.plays,
      viewers: entry.viewers.size,
      watchTimeTicks: entry.ticks,
    }))
    .sort((a, b) => b.viewers - a.viewers || b.plays - a.plays || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/**
 * The trailing window, zero-filled. Months with no finishes must still occupy
 * a column, or a quiet summer reads as a busy one.
 */
function activityMonths(
  finishes: ReadonlyMap<string, number>,
  now: Date,
  months: number,
): ActivityMonth[] {
  const result: ActivityMonth[] = [];
  const year = now.getFullYear();
  const month = now.getMonth();
  for (let offset = months - 1; offset >= 0; offset--) {
    const date = new Date(year, month - offset, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    result.push({
      key,
      label: `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`,
      titles: finishes.get(key) ?? 0,
    });
  }
  return result;
}

/** A finished item with no count still happened once. */
function playCount(item: BaseItemDto): number {
  return Math.max(1, item.UserData?.PlayCount ?? 1);
}

/** Episodes carry no studio of their own; their series' network stands in. */
function studioNames(item: BaseItemDto): string[] {
  const own = (item.Studios ?? []).map((studio) => studio.Name).filter(Boolean);
  if (own.length) return own;
  return item.SeriesStudio ? [item.SeriesStudio] : [];
}

function decadeOf(year: number | undefined): { key: string; label: string } | null {
  if (!year || year < 1000) return null;
  const start = Math.floor(year / 10) * 10;
  return { key: String(start), label: `${start}s` };
}

function monthKey(date: string | undefined): string | null {
  if (!date || date.length < 7) return null;
  const key = date.slice(0, 7);
  return /^\d{4}-\d{2}$/.test(key) ? key : null;
}

/** Episodes read better as "Series — Episode" in a "last watched" column. */
function titleOf(item: BaseItemDto): string {
  return item.Type === 'Episode' && item.SeriesName
    ? `${item.SeriesName} — ${item.Name}`
    : item.Name;
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

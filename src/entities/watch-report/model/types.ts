import { BaseItemDto } from '@shared/api';

/**
 * The shapes of a server-wide watch report. Everything here is *derived*:
 * core Jellyfin keeps no playback log, only a per-account tally on each item
 * (played, how many times, when last). See ADR 0006 for what that implies.
 */

/** One account's finished items, exactly as the server returned them. */
export interface UserPlayHistory {
  userId: string;
  userName: string;
  items: readonly BaseItemDto[];
  /** The account has finished more than one read returns; totals undercount. */
  truncated: boolean;
}

/** A named slice of watch time — a genre, a network, a decade. */
export interface RankedEntry {
  key: string;
  label: string;
  watchTimeTicks: number;
  /** Distinct titles counted into this entry. */
  titles: number;
  /** Fraction of all ranked watch time, 0–1 — including entries below the cut. */
  share: number;
}

export interface SeriesWatchStats {
  seriesId: string;
  name: string;
  /** Distinct episodes anyone finished. */
  episodes: number;
  plays: number;
  watchTimeTicks: number;
  /** Accounts that watched at least one episode. */
  viewers: number;
}

export interface MovieWatchStats {
  itemId: string;
  name: string;
  year: number | null;
  plays: number;
  viewers: number;
  watchTimeTicks: number;
}

export interface UserWatchStats {
  userId: string;
  userName: string;
  watchTimeTicks: number;
  plays: number;
  /** Distinct titles, not plays. */
  movies: number;
  episodes: number;
  topGenre: string | null;
  lastPlayed: string | null;
  lastPlayedName: string | null;
  truncated: boolean;
}

/** One bucket of the activity chart. */
export interface ActivityMonth {
  /** `YYYY-MM`. */
  key: string;
  label: string;
  /** Titles whose most recent finish falls in this month. */
  titles: number;
}

export interface WatchStatsTotals {
  watchTimeTicks: number;
  plays: number;
  /** Distinct titles finished by anyone. */
  titles: number;
  movies: number;
  episodes: number;
  /** Accounts that have finished anything. */
  activeUsers: number;
  accounts: number;
}

export interface ServerWatchStats {
  totals: WatchStatsTotals;
  /** Every account, busiest first. */
  users: UserWatchStats[];
  topGenres: RankedEntry[];
  topStudios: RankedEntry[];
  topSeries: SeriesWatchStats[];
  topMovies: MovieWatchStats[];
  /** Release decades of what was watched, oldest first. */
  decades: RankedEntry[];
  activity: ActivityMonth[];
  /** Mean community rating of what was watched; null when nothing is rated. */
  tasteRating: number | null;
  /** Any account's history was cut off by the read limit. */
  truncated: boolean;
}

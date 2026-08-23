import { Component, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  RankedEntry,
  formatShare,
  formatWatchSpan,
  formatWatchTime,
  groupThousands,
} from '@entities/watch-report';
import { ActivityColumn, ActivityColumns } from '@shared/ui/activity-columns';
import { RankedBar, RankedBars } from '@shared/ui/ranked-bars';
import { StatTile } from '@shared/ui/stat-tile';
import { AdminPageHeader } from '@widgets/admin-shell';
import { injectWatchStats } from '../model/watch-stats';

@Component({
  selector: 'jf-admin-stats-page',
  imports: [AdminPageHeader, ActivityColumns, DatePipe, RankedBars, StatTile],
  templateUrl: './admin-stats-page.html',
})
export class AdminStatsPage {
  private readonly report = injectWatchStats();

  protected readonly stats = this.report.stats;
  protected readonly isLoading = this.report.isLoading;
  protected readonly error = this.report.error;

  protected readonly watchTime = computed(() =>
    formatWatchSpan(this.stats()?.totals.watchTimeTicks ?? 0),
  );

  /** Hours phrasing beneath the days headline — one figure, two readings. */
  protected readonly watchTimeHours = computed(() => {
    const stats = this.stats();
    if (!stats) return undefined;
    return `${formatWatchTime(stats.totals.watchTimeTicks)} of playback, estimated`;
  });

  protected readonly titles = computed(() => {
    const totals = this.stats()?.totals;
    return totals ? groupThousands(totals.titles) : '—';
  });

  protected readonly titlesHint = computed(() => {
    const totals = this.stats()?.totals;
    if (!totals) return undefined;
    return `${groupThousands(totals.movies)} films · ${groupThousands(totals.episodes)} episodes`;
  });

  protected readonly plays = computed(() => {
    const totals = this.stats()?.totals;
    return totals ? groupThousands(totals.plays) : '—';
  });

  protected readonly playsHint = computed(() => {
    const totals = this.stats()?.totals;
    if (!totals || totals.titles === 0) return undefined;
    const perTitle = totals.plays / totals.titles;
    return `${perTitle.toFixed(2)} viewings per title`;
  });

  protected readonly accounts = computed(() => {
    const totals = this.stats()?.totals;
    return totals ? `${totals.activeUsers}/${totals.accounts}` : '—';
  });

  /** How much of what the server holds has actually been watched by someone. */
  protected readonly coverage = computed(() => {
    const totals = this.stats()?.totals;
    const counts = this.report.counts();
    if (!totals || !counts) return '—';
    const owned = (counts.MovieCount ?? 0) + (counts.EpisodeCount ?? 0);
    if (owned === 0) return '—';
    return formatShare((totals.movies + totals.episodes) / owned);
  });

  protected readonly coverageHint = computed(() => {
    const counts = this.report.counts();
    if (!counts) return undefined;
    const owned = (counts.MovieCount ?? 0) + (counts.EpisodeCount ?? 0);
    return `of ${groupThousands(owned)} titles in the library`;
  });

  protected readonly taste = computed(() => {
    const rating = this.stats()?.tasteRating;
    return rating == null ? '—' : `★ ${rating.toFixed(1)}`;
  });

  protected readonly genreBars = computed(() => this.toBars(this.stats()?.topGenres));
  protected readonly studioBars = computed(() => this.toBars(this.stats()?.topStudios));

  /** Decades are chronological, so they carry titles rather than a time ranking. */
  protected readonly decadeBars = computed<RankedBar[]>(
    () =>
      this.stats()?.decades.map((decade) => ({
        key: decade.key,
        label: decade.label,
        value: decade.titles,
        valueLabel: `${groupThousands(decade.titles)}`,
        hint: formatShare(decade.share),
      })) ?? [],
  );

  protected readonly activity = computed<ActivityColumn[]>(
    () =>
      this.stats()?.activity.map((month) => ({
        key: month.key,
        label: month.label,
        tick: month.label.slice(0, 3),
        value: month.titles,
      })) ?? [],
  );

  protected readonly series = computed(() => this.stats()?.topSeries ?? []);
  protected readonly movies = computed(() => this.stats()?.topMovies ?? []);
  protected readonly users = computed(() => this.stats()?.users ?? []);

  protected readonly skeletonRows = Array.from({ length: 4 }, (_, i) => i);

  protected watched(ticks: number): string {
    return formatWatchTime(ticks);
  }

  protected count(value: number): string {
    return groupThousands(value);
  }

  private toBars(entries: readonly RankedEntry[] | undefined): RankedBar[] {
    return (entries ?? []).map((entry) => ({
      key: entry.key,
      label: entry.label,
      value: entry.watchTimeTicks,
      valueLabel: formatWatchTime(entry.watchTimeTicks),
      hint: formatShare(entry.share),
    }));
  }
}

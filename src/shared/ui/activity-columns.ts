import { Component, computed, input } from '@angular/core';

export interface ActivityColumn {
  key: string;
  /** Full period name, for the table twin and the hover title. */
  label: string;
  /** Terse axis tick, e.g. "Aug". */
  tick: string;
  value: number;
}

/** A zero month still gets a stub, so "quiet" reads differently from "missing". */
const ZERO_HEIGHT = '2px';

/**
 * A column chart over an ordered, gap-free series of periods.
 *
 * The plot is decorative — every value is reachable through the table twin
 * underneath it — so the chart itself is hidden from assistive technology
 * instead of being papered over with ARIA.
 */
@Component({
  selector: 'jf-activity-columns',
  templateUrl: './activity-columns.html',
})
export class ActivityColumns {
  readonly columns = input.required<readonly ActivityColumn[]>();
  /** Names the table twin, e.g. "Titles finished per month". */
  readonly label = input.required<string>();
  /** What one unit is, for the table's value column, e.g. "Titles". */
  readonly unit = input('Value');

  protected readonly peak = computed(() =>
    this.columns().reduce((max, column) => Math.max(max, column.value), 0),
  );

  /** Every tick would crowd; a busiest-month label carries the scale instead. */
  protected readonly busiest = computed(() => {
    const peak = this.peak();
    return peak > 0 ? (this.columns().find((column) => column.value === peak) ?? null) : null;
  });

  protected height(column: ActivityColumn): string {
    const peak = this.peak();
    if (peak <= 0 || column.value <= 0) return ZERO_HEIGHT;
    return `${(column.value / peak) * 100}%`;
  }
}

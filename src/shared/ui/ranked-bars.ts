import { Component, computed, input } from '@angular/core';

export interface RankedBar {
  key: string;
  label: string;
  /** Magnitude to encode. The largest in the set fills the track. */
  value: number;
  /** The value as the reader should see it — always rendered, never tooltip-only. */
  valueLabel: string;
  /** Secondary detail, e.g. "12 titles". */
  hint?: string;
}

/** Below this a bar would vanish; a real value must stay visible. */
const MIN_WIDTH_PERCENT = 1.5;

/**
 * A ranked list of magnitudes: one measure, one colour, sorted by the caller.
 *
 * Every value is printed beside its label, so the bar is pure magnitude and
 * nothing is gated behind a hover. Bars scale to the largest entry rather than
 * to the total — the point is the ordering, not a part-to-whole reading.
 */
@Component({
  selector: 'jf-ranked-bars',
  templateUrl: './ranked-bars.html',
})
export class RankedBars {
  readonly entries = input.required<readonly RankedBar[]>();
  /** Names the list for assistive technology; the card heading supplies it. */
  readonly label = input.required<string>();

  private readonly peak = computed(() =>
    this.entries().reduce((max, entry) => Math.max(max, entry.value), 0),
  );

  protected width(entry: RankedBar): string {
    const peak = this.peak();
    if (peak <= 0 || entry.value <= 0) return '0%';
    return `${Math.max((entry.value / peak) * 100, MIN_WIDTH_PERCENT)}%`;
  }
}

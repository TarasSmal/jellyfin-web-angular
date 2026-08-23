import { Component, input } from '@angular/core';

/**
 * One number with its name. The dashboard's smallest unit — a lone figure is
 * a better chart than a one-bar bar chart.
 *
 * `hero` promotes the tile to the single leading figure of a view; use it once.
 * Figures stay proportional (never tabular) so a big number doesn't read loose.
 */
@Component({
  selector: 'jf-stat-tile',
  templateUrl: './stat-tile.html',
  host: { class: 'block rounded-xl border border-border bg-surface p-4' },
})
export class StatTile {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  /** Optional second line: a denominator, a caveat, a comparison. */
  readonly hint = input<string>();
  readonly hero = input(false);
}

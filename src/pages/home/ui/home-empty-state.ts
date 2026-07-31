import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Why the home screen has nothing to show. */
export type EmptyReason = 'no-libraries' | 'no-content';

/**
 * Home screen with nothing to show yet. Renders the silhouette of the real page
 * (hero + rails) behind a scrim so it reads as "your home screen, waiting"
 * rather than an error — and puts the fix one click away for administrators.
 */
@Component({
  selector: 'jf-home-empty-state',
  imports: [RouterLink],
  templateUrl: './home-empty-state.html',
})
export class HomeEmptyState {
  readonly reason = input.required<EmptyReason>();
  /** Only administrators can act on this; everyone else just waits. */
  readonly isAdmin = input.required<boolean>();
  /** Names of the (empty) libraries — used by the `no-content` copy. */
  readonly libraryNames = input<string[]>([]);

  /** Decorative silhouette of the real page behind the scrim. */
  protected readonly ghostRails = ['Continue Watching', 'Latest Movies', 'Latest Shows'];
  protected readonly ghostCards = [0, 1, 2, 3, 4, 5, 6, 7];

  /** "Movies and TV Shows" reads fine; a list of nine libraries does not. */
  protected readonly emptyLibraries = computed(() => {
    const names = this.libraryNames();
    if (names.length === 0) return 'Your libraries';
    if (names.length <= 2) return names.join(' and ');
    return 'Your libraries';
  });
}

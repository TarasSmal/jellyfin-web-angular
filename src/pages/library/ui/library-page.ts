import { Component, computed, effect, inject, input } from '@angular/core';
import { httpResource } from '@angular/common/http';
import {
  ApiConfig,
  BaseItemDto,
  ItemsResult,
  genresRequest,
  itemRequest,
} from '@shared/api';
import { ItemCard } from '@entities/item';
import { LibraryBrowser } from '../model/library-browser';

const SORT_OPTIONS = [
  { value: 'SortName', label: 'Name' },
  { value: 'DateCreated', label: 'Date added' },
  { value: 'CommunityRating', label: 'Rating' },
  { value: 'ProductionYear', label: 'Year' },
] as const;

@Component({
  selector: 'app-library-page',
  imports: [ItemCard],
  providers: [LibraryBrowser],
  template: `
    <main class="min-h-dvh px-6 pt-24 pb-16 md:px-12">
      <div class="mb-6 flex flex-wrap items-center gap-3">
        <h1 class="mr-auto text-2xl font-bold tracking-tight">
          {{ library.value()?.Name ?? 'Library' }}
          @if (browser.total() !== null) {
            <span class="ml-2 text-base font-normal text-text-faint">{{ browser.total() }}</span>
          }
        </h1>

        <select
          class="rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none"
          [value]="browser.params().sortBy"
          (change)="onSortBy($event)"
        >
          @for (opt of sortOptions; track opt.value) {
            <option [value]="opt.value">{{ opt.label }}</option>
          }
        </select>

        <button
          type="button"
          class="rounded-lg border border-border bg-surface px-3 py-2 text-sm transition-colors hover:text-accent"
          (click)="toggleOrder()"
        >
          {{ browser.params().sortOrder === 'Ascending' ? '↑' : '↓' }}
        </button>

        <select
          class="max-w-40 rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none"
          [value]="browser.params().genre ?? ''"
          (change)="onGenre($event)"
        >
          <option value="">All genres</option>
          @for (genre of genres(); track genre.Id) {
            <option [value]="genre.Name">{{ genre.Name }}</option>
          }
        </select>

        <button
          type="button"
          class="rounded-lg border px-3 py-2 text-sm transition-colors"
          [class.border-accent]="browser.params().unplayedOnly"
          [class.text-accent]="browser.params().unplayedOnly"
          [class.border-border]="!browser.params().unplayedOnly"
          [class.bg-surface]="!browser.params().unplayedOnly"
          (click)="browser.setParams({ unplayedOnly: !browser.params().unplayedOnly })"
        >
          Unwatched
        </button>
      </div>

      @if (browser.error()) {
        <p class="py-12 text-center text-danger">Failed to load this library.</p>
      }

      <div class="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-4 md:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]">
        @for (item of browser.items(); track item.Id) {
          <app-item-card [item]="item" [fluid]="true" />
        }
        @if (browser.loading()) {
          @for (i of skeletons; track i) {
            <div class="aspect-poster w-full animate-pulse rounded-lg bg-surface"></div>
          }
        }
      </div>

      @if (browser.hasMore() && !browser.loading()) {
        <div class="mt-8 text-center">
          <button
            type="button"
            class="rounded-lg border border-border bg-surface px-6 py-2.5 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
            (click)="browser.loadMore()"
          >
            Load more
          </button>
        </div>
      }
    </main>
  `,
})
export class LibraryPage {
  private readonly config = inject(ApiConfig);
  protected readonly browser = inject(LibraryBrowser);

  /** Route param via withComponentInputBinding. */
  readonly id = input.required<string>();

  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly skeletons = Array.from({ length: 12 }, (_, i) => i);

  protected readonly library = httpResource<BaseItemDto>(() => itemRequest(this.config, this.id()));
  private readonly genresResource = httpResource<ItemsResult>(() => genresRequest(this.config, this.id()));
  protected readonly genres = computed(() => this.genresResource.value()?.Items ?? []);

  constructor() {
    // Start browsing once the library's kind is known — a movies library
    // browses Movie items, a TV library Series (not seasons/episodes).
    effect(() => {
      const library = this.library.value();
      if (!library) return;
      const includeItemTypes =
        library.CollectionType === 'movies'
          ? 'Movie'
          : library.CollectionType === 'tvshows'
            ? 'Series'
            : undefined;
      this.browser.init(this.id(), includeItemTypes);
    });
  }

  protected onSortBy(event: Event): void {
    this.browser.setParams({
      sortBy: (event.target as HTMLSelectElement).value as never,
      sortOrder: 'Ascending',
    });
  }

  protected toggleOrder(): void {
    this.browser.setParams({
      sortOrder: this.browser.params().sortOrder === 'Ascending' ? 'Descending' : 'Ascending',
    });
  }

  protected onGenre(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.browser.setParams({ genre: value || null });
  }
}

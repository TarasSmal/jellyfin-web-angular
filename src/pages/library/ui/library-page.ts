import { Component, computed, effect, inject, input } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { ApiConfig, BaseItemDto, ItemsResult, genresRequest, itemRequest } from '@shared/api';
import { ItemCard } from '@entities/item';
import { LibraryBrowser } from '../model/library-browser';

const SORT_OPTIONS = [
  { value: 'SortName', label: 'Name' },
  { value: 'DateCreated', label: 'Date added' },
  { value: 'CommunityRating', label: 'Rating' },
  { value: 'ProductionYear', label: 'Year' },
] as const;

@Component({
  selector: 'jf-library-page',
  imports: [ItemCard],
  providers: [LibraryBrowser],
  templateUrl: './library-page.html',
})
export class LibraryPage {
  private readonly config = inject(ApiConfig);
  protected readonly browser = inject(LibraryBrowser);

  /** Route param via withComponentInputBinding. */
  readonly id = input.required<string>();

  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly skeletons = Array.from({ length: 12 }, (_, i) => i);

  protected readonly library = httpResource<BaseItemDto>(() => itemRequest(this.config, this.id()));
  protected readonly genresResource = httpResource<ItemsResult>(() =>
    genresRequest(this.config, this.id()),
  );
  protected readonly genres = computed(() => this.genresResource.value()?.Items ?? []);

  protected readonly failed = computed(
    () => this.library.error() !== undefined || this.browser.error(),
  );
  /** Skeletons cover both legs of a library switch: its metadata, then its first page. */
  protected readonly pending = computed(() => !this.failed() && this.browser.loading());

  constructor() {
    // Start browsing once the library's kind is known — a movies library
    // browses Movie items, a TV library Series (not seasons/episodes).
    effect(() => {
      const id = this.id();
      const library = this.library.value();
      // Navigating to another library reuses this component, so drop the old
      // library's items right away rather than leaving them on screen until
      // the new metadata and first page have both landed.
      if (library?.Id !== id) {
        this.browser.reset();
        return;
      }
      const includeItemTypes =
        library.CollectionType === 'movies'
          ? 'Movie'
          : library.CollectionType === 'tvshows'
            ? 'Series'
            : undefined;
      this.browser.init(id, includeItemTypes);
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

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
  private readonly genresResource = httpResource<ItemsResult>(() =>
    genresRequest(this.config, this.id()),
  );
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

import { Component, inject, input } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { ApiConfig, ItemsResult, searchRequest } from '@shared/api';
import { ItemCard } from '@entities/item';

@Component({
  selector: 'app-search-page',
  imports: [ItemCard],
  template: `
    <main class="min-h-dvh px-6 pt-24 pb-16 md:px-12">
      <h1 class="mb-6 text-2xl font-bold tracking-tight">
        @if (q()) {
          Results for “{{ q() }}”
          @if (results.value(); as r) {
            <span class="ml-2 text-base font-normal text-text-faint">{{ r.TotalRecordCount }}</span>
          }
        } @else {
          Search
        }
      </h1>

      @if (!q()) {
        <p class="text-text-muted">Type in the search box above to find movies and shows.</p>
      } @else if (results.isLoading()) {
        <div class="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-4 md:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]">
          @for (i of skeletons; track i) {
            <div class="aspect-poster w-full animate-pulse rounded-lg bg-surface"></div>
          }
        </div>
      } @else if (!results.value()?.Items?.length) {
        <p class="text-text-muted">Nothing found.</p>
      } @else {
        <div class="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-4 md:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]">
          @for (item of results.value()?.Items; track item.Id) {
            <app-item-card [item]="item" [fluid]="true" />
          }
        </div>
      }
    </main>
  `,
})
export class SearchPage {
  private readonly config = inject(ApiConfig);

  /** Bound from the ?q= query param via withComponentInputBinding. */
  readonly q = input('');

  protected readonly skeletons = Array.from({ length: 6 }, (_, i) => i);
  protected readonly results = httpResource<ItemsResult>(() => searchRequest(this.config, this.q()));
}

import { Component, inject, input } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { ApiConfig, ItemsResult, searchRequest } from '@shared/api';
import { ItemCard } from '@entities/item';

@Component({
  selector: 'jf-search-page',
  imports: [ItemCard],
  templateUrl: './search-page.html',
})
export class SearchPage {
  private readonly config = inject(ApiConfig);

  /** Bound from the ?q= query param via withComponentInputBinding. */
  readonly q = input('');

  protected readonly skeletons = Array.from({ length: 6 }, (_, i) => i);
  protected readonly results = httpResource<ItemsResult>(() =>
    searchRequest(this.config, this.q()),
  );
}

import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiConfig, BaseItemDto, ItemsQuery, ItemsResult, itemsRequest } from '@shared/api';

const PAGE_SIZE = 100;

export interface BrowseParams {
  sortBy: NonNullable<ItemsQuery['sortBy']>;
  sortOrder: NonNullable<ItemsQuery['sortOrder']>;
  unplayedOnly: boolean;
  genre: string | null;
}

export const DEFAULT_PARAMS: BrowseParams = {
  sortBy: 'SortName',
  sortOrder: 'Ascending',
  unplayedOnly: false,
  genre: null,
};

/**
 * Accumulates pages of one library so "Load more" appends instead of
 * replacing — which is why this is a store and not a bare httpResource.
 * Provided per page component; state resets with the route.
 */
@Injectable()
export class LibraryBrowser {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ApiConfig);

  private libraryId: string | null = null;
  private includeItemTypes: string | undefined;
  private requestSeq = 0;

  readonly params = signal<BrowseParams>(DEFAULT_PARAMS);
  readonly items = signal<BaseItemDto[]>([]);
  readonly total = signal<number | null>(null);
  readonly loading = signal(false);
  readonly error = signal<boolean>(false);
  readonly hasMore = computed(() => {
    const total = this.total();
    return total !== null && this.items().length < total;
  });

  init(libraryId: string, includeItemTypes: string | undefined): void {
    if (this.libraryId === libraryId && this.includeItemTypes === includeItemTypes) return;
    this.libraryId = libraryId;
    this.includeItemTypes = includeItemTypes;
    void this.reload();
  }

  setParams(patch: Partial<BrowseParams>): void {
    this.params.update((p) => ({ ...p, ...patch }));
    void this.reload();
  }

  async reload(): Promise<void> {
    this.items.set([]);
    this.total.set(null);
    await this.fetchPage(0);
  }

  async loadMore(): Promise<void> {
    if (this.loading() || !this.hasMore()) return;
    await this.fetchPage(this.items().length);
  }

  private async fetchPage(startIndex: number): Promise<void> {
    if (!this.libraryId) return;
    const seq = ++this.requestSeq;
    this.loading.set(true);
    this.error.set(false);
    const { sortBy, sortOrder, unplayedOnly, genre } = this.params();
    const req = itemsRequest(this.config, {
      parentId: this.libraryId,
      includeItemTypes: this.includeItemTypes,
      sortBy,
      sortOrder,
      unplayedOnly,
      genre: genre ?? undefined,
      startIndex,
      limit: PAGE_SIZE,
    });
    if (!req) return;
    try {
      const result = await firstValueFrom(
        this.http.get<ItemsResult>(req.url, { params: req.params as Record<string, string | number | boolean> }),
      );
      if (seq !== this.requestSeq) return; // superseded by a newer request
      this.items.update((existing) => (startIndex === 0 ? result.Items : [...existing, ...result.Items]));
      this.total.set(result.TotalRecordCount);
    } catch {
      if (seq === this.requestSeq) this.error.set(true);
    } finally {
      if (seq === this.requestSeq) this.loading.set(false);
    }
  }
}

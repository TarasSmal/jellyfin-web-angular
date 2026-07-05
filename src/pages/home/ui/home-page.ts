import { Component, computed, inject } from '@angular/core';
import { httpResource } from '@angular/common/http';
import {
  ApiConfig,
  BaseItemDto,
  ItemsResult,
  latestItemsRequest,
  nextUpRequest,
  resumeItemsRequest,
  userViewsRequest,
} from '@shared/api';
import { HeroBillboard } from '@widgets/hero-billboard';
import { MediaRail } from '@widgets/media-rail';
import { selectFeaturedItems } from '../model/featured-items';

@Component({
  selector: 'jf-home-page',
  imports: [HeroBillboard, MediaRail],
  templateUrl: './home-page.html',
})
export class HomePage {
  private readonly config = inject(ApiConfig);

  protected readonly views = httpResource<ItemsResult>(() => userViewsRequest(this.config));
  protected readonly resume = httpResource<ItemsResult>(() => resumeItemsRequest(this.config));
  protected readonly nextUp = httpResource<ItemsResult>(() => nextUpRequest(this.config));

  private readonly moviesViewId = computed(
    () => this.views.value()?.Items.find((v) => v.CollectionType === 'movies')?.Id,
  );
  private readonly showsViewId = computed(
    () => this.views.value()?.Items.find((v) => v.CollectionType === 'tvshows')?.Id,
  );

  protected readonly latestMovies = httpResource<BaseItemDto[]>(() => {
    const id = this.moviesViewId();
    return id ? latestItemsRequest(this.config, id) : undefined;
  });
  protected readonly latestShows = httpResource<BaseItemDto[]>(() => {
    const id = this.showsViewId();
    return id ? latestItemsRequest(this.config, id) : undefined;
  });

  /** The Featured Items the hero billboard rotates through. */
  protected readonly featured = computed(() =>
    selectFeaturedItems(this.latestMovies.value() ?? [], this.latestShows.value() ?? []),
  );

  protected readonly featuredLoading = computed(
    () => this.latestMovies.isLoading() || this.latestShows.isLoading(),
  );
}

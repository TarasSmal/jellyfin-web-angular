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
import { SessionStore } from '@entities/user';
import { HeroBillboard } from '@widgets/hero-billboard';
import { MediaRail } from '@widgets/media-rail';
import { selectFeaturedItems } from '../model/featured-items';
import { EmptyReason, HomeEmptyState } from './home-empty-state';

@Component({
  selector: 'jf-home-page',
  imports: [HeroBillboard, MediaRail, HomeEmptyState],
  templateUrl: './home-page.html',
})
export class HomePage {
  private readonly config = inject(ApiConfig);
  private readonly session = inject(SessionStore);

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

  protected readonly isAdmin = this.session.isAdmin;

  protected readonly libraryNames = computed(
    () => this.views.value()?.Items.map((v) => v.Name) ?? [],
  );

  /**
   * Why the page has nothing to show, or `null` while it still might. Only
   * settles once every rail has finished loading, so a slow server never
   * flashes the empty state on the way to real content.
   */
  protected readonly emptyReason = computed<EmptyReason | null>(() => {
    const views = this.views.value();
    if (this.views.isLoading() || !views) return null;
    // No views at all: the server has no libraries, or none are shared with this user.
    if (views.Items.length === 0) return 'no-libraries';

    const settled =
      !this.resume.isLoading() &&
      !this.nextUp.isLoading() &&
      !this.latestMovies.isLoading() &&
      !this.latestShows.isLoading();
    const nothing =
      !this.resume.value()?.Items.length &&
      !this.nextUp.value()?.Items.length &&
      !this.latestMovies.value()?.length &&
      !this.latestShows.value()?.length;

    return settled && nothing ? 'no-content' : null;
  });
}

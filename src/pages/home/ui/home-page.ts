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

  /** Featured item: newest movie with a backdrop, else newest show, else a resume item. */
  protected readonly hero = computed<BaseItemDto | undefined>(() => {
    const candidates = [
      ...(this.latestMovies.value() ?? []),
      ...(this.latestShows.value() ?? []),
      ...(this.resume.value()?.Items ?? []),
    ];
    return candidates.find((i) => i.BackdropImageTags?.length) ?? candidates[0];
  });
}

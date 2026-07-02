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
  selector: 'app-home-page',
  imports: [HeroBillboard, MediaRail],
  template: `
    <main class="pb-16">
      @if (hero(); as heroItem) {
        <app-hero-billboard [item]="heroItem" />
      } @else {
        <div class="aspect-[16/8] max-h-[75dvh] min-h-96 w-full animate-pulse bg-surface"></div>
      }

      <div class="relative z-10 -mt-8 space-y-10">
        <app-media-rail
          title="Continue Watching"
          shape="thumb"
          [items]="resume.value()?.Items"
          [loading]="resume.isLoading()"
        />
        <app-media-rail
          title="Next Up"
          shape="thumb"
          [items]="nextUp.value()?.Items"
          [loading]="nextUp.isLoading()"
        />
        <app-media-rail
          title="Latest Movies"
          [items]="latestMovies.value()"
          [loading]="latestMovies.isLoading()"
        />
        <app-media-rail
          title="Latest Shows"
          [items]="latestShows.value()"
          [loading]="latestShows.isLoading()"
        />
      </div>
    </main>
  `,
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

import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiConfig, BaseItemDto } from '@shared/api';
import { itemThumbHash, itemThumbSrcset, itemThumbUrl } from '@entities/item';
import { BlurImg } from '@shared/ui/blur-img';
import { formatRuntime } from '@shared/lib/ticks';

@Component({
  selector: 'jf-episode-list',
  imports: [RouterLink, BlurImg],
  templateUrl: './episode-list.html',
})
export class EpisodeList {
  private readonly config = inject(ApiConfig);

  readonly episodes = input<BaseItemDto[] | undefined>(undefined);
  readonly loading = input(false);

  protected readonly skeletons = Array.from({ length: 6 }, (_, i) => i);

  protected thumb(episode: BaseItemDto): string | null {
    return itemThumbUrl(this.config, episode, 400);
  }

  protected thumbHash(episode: BaseItemDto): string | null {
    return itemThumbHash(episode);
  }

  protected thumbSrcset(episode: BaseItemDto): string | null {
    return itemThumbSrcset(this.config, episode, 400);
  }

  protected runtime(ticks: number): string {
    return formatRuntime(ticks);
  }

  protected progress(episode: BaseItemDto): number | null {
    const pct = episode.UserData?.PlayedPercentage;
    return pct && pct > 0 && pct < 100 ? pct : null;
  }
}

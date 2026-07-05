import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiConfig, BaseItemDto } from '@shared/api';
import { itemBackdropHash, itemBackdropSrcset, itemBackdropUrl, itemLogoUrl } from '@entities/item';
import { BlurImg } from '@shared/ui/blur-img';
import { Rotator, RotatorSlide } from '@shared/ui/rotator';
import { formatRuntime } from '@shared/lib/ticks';

interface HeroSlide {
  item: BaseItemDto;
  backdropUrl: string | null;
  backdropHash: string | null;
  backdropSrcset: string | null;
  logoUrl: string | null;
  runtime: string | null;
  /** Only the first slide's backdrop competes for bandwidth at high priority. */
  priority: boolean;
}

@Component({
  selector: 'jf-hero-billboard',
  imports: [RouterLink, BlurImg, Rotator, RotatorSlide],
  templateUrl: './hero-billboard.html',
})
export class HeroBillboard {
  private readonly config = inject(ApiConfig);

  /** The Featured Items to rotate through; a single item renders statically. */
  readonly items = input.required<BaseItemDto[]>();

  protected readonly slides = computed<HeroSlide[]>(() =>
    this.items().map((item, index) => ({
      item,
      backdropUrl: itemBackdropUrl(this.config, item),
      backdropHash: itemBackdropHash(item),
      backdropSrcset: itemBackdropSrcset(this.config, item),
      logoUrl: itemLogoUrl(this.config, item),
      runtime: item.RunTimeTicks ? formatRuntime(item.RunTimeTicks) : null,
      priority: index === 0,
    })),
  );
}

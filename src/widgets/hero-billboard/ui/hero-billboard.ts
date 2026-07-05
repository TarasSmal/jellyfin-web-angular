import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiConfig, BaseItemDto } from '@shared/api';
import { itemBackdropUrl, itemLogoUrl } from '@entities/item';
import { formatRuntime } from '@shared/lib/ticks';

@Component({
  selector: 'jf-hero-billboard',
  imports: [RouterLink],
  templateUrl: './hero-billboard.html',
})
export class HeroBillboard {
  private readonly config = inject(ApiConfig);

  readonly item = input.required<BaseItemDto>();

  protected readonly backdropUrl = computed(() => itemBackdropUrl(this.config, this.item()));
  protected readonly logoUrl = computed(() => itemLogoUrl(this.config, this.item()));
  protected readonly runtime = computed(() => {
    const ticks = this.item().RunTimeTicks;
    return ticks ? formatRuntime(ticks) : null;
  });
}

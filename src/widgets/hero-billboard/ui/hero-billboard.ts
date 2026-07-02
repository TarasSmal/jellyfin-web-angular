import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiConfig, BaseItemDto } from '@shared/api';
import { itemBackdropUrl } from '@entities/item';
import { formatRuntime } from '@shared/lib/ticks';

@Component({
  selector: 'app-hero-billboard',
  imports: [RouterLink],
  template: `
    <section class="relative aspect-[16/8] max-h-[75dvh] min-h-96 w-full overflow-hidden">
      @if (backdropUrl(); as url) {
        <img [src]="url" [alt]="item().Name" class="absolute inset-0 h-full w-full object-cover object-top" />
      }
      <!-- Peacock-style scrims: bottom fade into the page, left fade behind the text -->
      <div class="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent"></div>
      <div class="absolute inset-0 bg-gradient-to-r from-bg/80 via-transparent to-transparent"></div>

      <div class="absolute inset-x-6 bottom-10 max-w-xl space-y-4 md:inset-x-12">
        <h1 class="text-3xl font-bold tracking-tight md:text-5xl">{{ item().Name }}</h1>
        <p class="space-x-3 text-sm text-text-muted">
          @if (item().ProductionYear; as year) {
            <span>{{ year }}</span>
          }
          @if (runtime(); as rt) {
            <span>{{ rt }}</span>
          }
          @if (item().OfficialRating; as rating) {
            <span class="rounded border border-border px-1.5 py-0.5 text-xs">{{ rating }}</span>
          }
        </p>
        @if (item().Overview; as overview) {
          <p class="line-clamp-3 text-sm text-text-muted md:text-base">{{ overview }}</p>
        }
        <div class="flex gap-3 pt-1">
          <a
            [routerLink]="['/item', item().Id]"
            class="rounded-lg bg-text px-6 py-2.5 font-semibold text-bg transition-opacity hover:opacity-80"
          >
            Details
          </a>
        </div>
      </div>
    </section>
  `,
})
export class HeroBillboard {
  private readonly config = inject(ApiConfig);

  readonly item = input.required<BaseItemDto>();

  protected readonly backdropUrl = computed(() => itemBackdropUrl(this.config, this.item()));
  protected readonly runtime = computed(() => {
    const ticks = this.item().RunTimeTicks;
    return ticks ? formatRuntime(ticks) : null;
  });
}

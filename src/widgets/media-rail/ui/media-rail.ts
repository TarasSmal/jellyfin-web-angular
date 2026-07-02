import { Component, input } from '@angular/core';
import { BaseItemDto } from '@shared/api';
import { ItemCard } from '@entities/item';

@Component({
  selector: 'app-media-rail',
  imports: [ItemCard],
  template: `
    @if (loading() || items()?.length) {
      <section class="space-y-3">
        <h2 class="px-6 text-lg font-semibold md:px-12">{{ title() }}</h2>
        <div class="flex snap-x gap-3 overflow-x-auto px-6 pb-2 md:px-12">
          @if (loading()) {
            @for (i of skeletons; track i) {
              <div
                class="shrink-0 animate-pulse rounded-lg bg-surface"
                [class.w-36]="shape() === 'poster'"
                [class.md:w-44]="shape() === 'poster'"
                [class.aspect-poster]="shape() === 'poster'"
                [class.w-64]="shape() === 'thumb'"
                [class.md:w-72]="shape() === 'thumb'"
                [class.aspect-backdrop]="shape() === 'thumb'"
              ></div>
            }
          } @else {
            @for (item of items(); track item.Id) {
              <app-item-card [item]="item" [shape]="shape()" />
            }
          }
        </div>
      </section>
    }
  `,
})
export class MediaRail {
  readonly title = input.required<string>();
  readonly items = input<BaseItemDto[] | undefined>(undefined);
  readonly shape = input<'poster' | 'thumb'>('poster');
  readonly loading = input(false);

  protected readonly skeletons = Array.from({ length: 8 }, (_, i) => i);
}

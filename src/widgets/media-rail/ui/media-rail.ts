import { Component, input } from '@angular/core';
import { BaseItemDto } from '@shared/api';
import { ItemCard } from '@entities/item';

@Component({
  selector: 'jf-media-rail',
  imports: [ItemCard],
  templateUrl: './media-rail.html',
})
export class MediaRail {
  readonly title = input.required<string>();
  readonly items = input<BaseItemDto[] | undefined>(undefined);
  readonly shape = input<'poster' | 'thumb'>('poster');
  readonly loading = input(false);

  protected readonly skeletons = Array.from({ length: 8 }, (_, i) => i);
}

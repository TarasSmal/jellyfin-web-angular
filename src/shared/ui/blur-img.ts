import {
  Component,
  ElementRef,
  effect,
  input,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { paintBlurhash } from '@shared/lib/blurhash';

/**
 * An `<img>` with an instant BlurHash placeholder underneath and a fade-in on
 * load. The host must be given a size (and a position class) by the caller.
 * Not for transparent images (logos) — the placeholder would bleed through.
 */
@Component({
  selector: 'jf-blur-img',
  templateUrl: './blur-img.html',
  host: { class: 'block' },
})
export class BlurImg {
  readonly src = input.required<string>();
  readonly alt = input('');
  /** BlurHash string from the item DTO; null falls back to the bare img. */
  readonly hash = input<string | null>(null);
  readonly fit = input<'cover' | 'contain'>('cover');
  /** Anchor to the top edge (hero backdrops crop the bottom, not the face). */
  readonly positionTop = input(false);
  /** Eager + fetchpriority=high for LCP images; everything else lazy-loads. */
  readonly priority = input(false);
  readonly srcset = input<string | null>(null);
  readonly sizes = input<string | null>(null);

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('placeholder');

  protected readonly painted = signal(false);
  /** Keyed on src so a recycled card fades in again for its new image. */
  protected readonly loaded = linkedSignal({
    source: this.src,
    computation: () => false,
  });

  constructor() {
    effect(() => {
      const hash = this.hash();
      this.painted.set(hash !== null && paintBlurhash(this.canvas().nativeElement, hash));
    });
  }
}

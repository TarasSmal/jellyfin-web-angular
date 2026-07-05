import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  DestroyRef,
  TemplateRef,
  computed,
  contentChildren,
  inject,
  input,
  signal,
} from '@angular/core';
import { createRotation } from './rotation';
import { RotatorSlide } from './rotator-slide';

/** How long a replaced slide lingers so the incoming one can fade in over it. */
const FADE_MS = 500;

type SlideState = 'active' | 'upcoming' | 'leaving';

interface RenderedSlide {
  index: number;
  template: TemplateRef<unknown>;
  state: SlideState;
}

/**
 * Rotator: shows one slide at a time and cycles through the rest.
 * Distinct from a Rail (many cards, scrolls); see CONTEXT.md.
 *
 * Only the active slide, the upcoming one (pre-rendered hidden so its images
 * are cached before the crossfade), and — briefly — the outgoing one exist.
 */
@Component({
  selector: 'jf-rotator',
  imports: [NgTemplateOutlet],
  templateUrl: './rotator.html',
})
export class Rotator {
  /** Accessible name for the carousel region. */
  readonly label = input.required<string>();

  private readonly slides = contentChildren(RotatorSlide);
  protected readonly count = computed(() => this.slides().length);
  protected readonly rotation = createRotation(this.count);

  /** Slide fading out under the incoming one; unmounts once the fade ends. */
  private readonly leaving = signal<number | null>(null);
  private leaveTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.leaveTimer));
  }

  protected readonly rendered = computed<RenderedSlide[]>(() => {
    const slides = this.slides();
    const active = this.rotation.activeIndex();
    const upcoming = this.rotation.upcomingIndex();
    const leaving = this.leaving();

    const entries: RenderedSlide[] = [];
    const push = (index: number | null, state: SlideState) => {
      if (index === null) return;
      const slide = slides[index];
      if (slide) entries.push({ index, template: slide.template, state });
    };
    push(active, 'active');
    if (upcoming !== active) push(upcoming, 'upcoming');
    if (leaving !== active && leaving !== upcoming) push(leaving, 'leaving');
    return entries;
  });

  protected next(): void {
    this.beginFade();
    this.rotation.next();
  }

  protected previous(): void {
    this.beginFade();
    this.rotation.previous();
  }

  /** Keep the current slide mounted underneath while its successor fades in. */
  private beginFade(): void {
    this.leaving.set(this.rotation.activeIndex());
    clearTimeout(this.leaveTimer);
    this.leaveTimer = setTimeout(() => this.leaving.set(null), FADE_MS);
  }
}

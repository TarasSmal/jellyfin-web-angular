import { NgTemplateOutlet } from '@angular/common';
import { MediaMatcher } from '@angular/cdk/layout';
import {
  Component,
  DestroyRef,
  TemplateRef,
  computed,
  contentChildren,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { ROTATION_INTERVAL_MS, createRotation } from './rotation';
import { RotatorSlide } from './rotator-slide';

/** How long a replaced slide lingers so the incoming one can fade in over it. */
const FADE_MS = 500;

/** Horizontal travel below this is a tap, not a swipe. */
const SWIPE_MIN_PX = 48;

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
  protected readonly indices = computed(() => Array.from({ length: this.count() }, (_, i) => i));

  /** WCAG 2.2.2: hovering or tabbing in suspends auto-rotation. */
  protected readonly hovered = signal(false);
  protected readonly focused = signal(false);

  protected readonly autoRotate = !inject(MediaMatcher).matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;

  protected readonly rotation = createRotation(this.count, {
    autoRotate: this.autoRotate,
    held: computed(() => this.hovered() || this.focused()),
  });

  /**
   * Auto-rotation is still in play (allowed, several slides, not stopped for
   * good). The pause control and the active dot's fill only exist while true.
   */
  protected readonly autoLive = computed(
    () => this.rotation.multi() && this.autoRotate && !this.rotation.stopped(),
  );

  /** The dot fill sweeps exactly one rotation interval. */
  protected readonly intervalMs = ROTATION_INTERVAL_MS;

  /**
   * The rotation model restarts its full interval whenever auto-rotation
   * resumes, so the fill must restart from zero too — a paused CSS animation
   * would resume mid-sweep and finish ahead of the actual slide change.
   * Each bump flips the fill bar's keyframe alias, restarting its animation.
   */
  protected readonly fillEpoch = signal(0);

  /** Slide fading out under the incoming one; unmounts once the fade ends. */
  private readonly leaving = signal<number | null>(null);
  private leaveTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.leaveTimer));

    // Fade on every slide change, whether the viewer navigated or the timer did.
    let previous: number | null = null;
    effect(() => {
      const active = this.rotation.activeIndex();
      if (previous !== null && previous !== active) this.beginFade(previous);
      previous = active;
    });

    effect(() => {
      if (this.rotation.autoRotating()) this.fillEpoch.update((n) => n + 1);
    });
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

  protected goTo(index: number): void {
    if (index === this.rotation.activeIndex()) return;
    this.rotation.goTo(index);
  }

  /**
   * Synthetic swipe: no draggable track, just start/end comparison. Touch and
   * pen only — a mouse drag should keep selecting text, not change slides.
   * Vertical scrolling stays native (`touch-pan-y` on the section); when the
   * browser claims the gesture for scrolling it cancels the pointer and no
   * navigation happens.
   */
  private swipeStart: { id: number; x: number; y: number } | null = null;

  protected onPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' || !this.rotation.multi()) return;
    this.swipeStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }

  protected onPointerUp(event: PointerEvent): void {
    const start = this.swipeStart;
    this.swipeStart = null;
    if (!start || event.pointerId !== start.id) return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    // Axis lock: a mostly-vertical drag is a scroll attempt, never navigation.
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) <= Math.abs(dy)) return;
    if (dx < 0) this.rotation.next();
    else this.rotation.previous();
  }

  protected onPointerCancel(): void {
    this.swipeStart = null;
  }

  /** Keep the outgoing slide mounted underneath while its successor fades in. */
  private beginFade(outgoing: number): void {
    this.leaving.set(outgoing);
    clearTimeout(this.leaveTimer);
    this.leaveTimer = setTimeout(() => this.leaving.set(null), FADE_MS);
  }
}

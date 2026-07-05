import { Signal, computed, linkedSignal } from '@angular/core';

/**
 * Headless state machine for a Rotator: which slide is active and which one
 * is pre-rendered next. DOM-free so the cycling rules can be tested alone.
 */
export interface Rotation {
  /** Index of the slide currently shown. */
  readonly activeIndex: Signal<number>;
  /** Index of the slide to pre-render hidden, or null when there is none. */
  readonly upcomingIndex: Signal<number | null>;
  /** Whether there is anything to rotate through; controls hide when false. */
  readonly multi: Signal<boolean>;
  /** Show the next slide, wrapping from the last back to the first. */
  next(): void;
  /** Show the previous slide, wrapping from the first back to the last. */
  previous(): void;
  /** Jump straight to a slide. */
  goTo(index: number): void;
}

export function createRotation(count: Signal<number>): Rotation {
  // Clamp rather than reset when the slide set changes size, so slides
  // arriving or leaving never strand the rotator on a hole.
  const activeIndex = linkedSignal<number, number>({
    source: count,
    computation: (c, previous) => Math.min(previous?.value ?? 0, Math.max(c - 1, 0)),
  });
  const multi = computed(() => count() > 1);
  const upcomingIndex = computed(() => (multi() ? (activeIndex() + 1) % count() : null));
  return {
    activeIndex: activeIndex.asReadonly(),
    upcomingIndex,
    multi,
    next: () => activeIndex.update((i) => (i + 1) % count()),
    previous: () => activeIndex.update((i) => (i - 1 + count()) % count()),
    goTo: (index) => activeIndex.set(index),
  };
}

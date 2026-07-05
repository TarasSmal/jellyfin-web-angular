import { Injector, Signal, computed, effect, linkedSignal, signal } from '@angular/core';

/** How long each slide stays before auto-rotation advances. */
export const ROTATION_INTERVAL_MS = 7000;

/**
 * Enables auto-rotation. Creating the timer requires an injection context
 * (or an explicit `injector`); omit the options for a manual-only rotation.
 */
export interface RotationOptions {
  intervalMs?: number;
  injector?: Injector;
  /** Transient suspension, e.g. while hovered or focused; resumes when false. */
  held?: Signal<boolean>;
  /** Set false to forbid auto-rotation entirely (reduced motion). Default true. */
  autoRotate?: boolean;
}

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
  /** Whether the viewer paused auto-rotation via the toggle. */
  readonly paused: Signal<boolean>;
  /** Whether auto-rotation is over for good (the viewer navigated manually). */
  readonly stopped: Signal<boolean>;
  /** Whether the auto-advance timer is running right now. */
  readonly autoRotating: Signal<boolean>;
  /** Pause auto-rotation, or resume it if already paused. */
  togglePaused(): void;
}

export function createRotation(count: Signal<number>, options?: RotationOptions): Rotation {
  // Clamp rather than reset when the slide set changes size, so slides
  // arriving or leaving never strand the rotator on a hole.
  const activeIndex = linkedSignal<number, number>({
    source: count,
    computation: (c, previous) => Math.min(previous?.value ?? 0, Math.max(c - 1, 0)),
  });
  const multi = computed(() => count() > 1);
  const upcomingIndex = computed(() => (multi() ? (activeIndex() + 1) % count() : null));
  const paused = signal(false);
  const stopped = signal(false);

  const autoAllowed = !!options && (options.autoRotate ?? true);
  const autoRotating = computed(
    () => autoAllowed && multi() && !paused() && !stopped() && !(options?.held?.() ?? false),
  );

  if (autoAllowed) {
    const intervalMs = options?.intervalMs ?? ROTATION_INTERVAL_MS;
    effect(
      (onCleanup) => {
        if (!autoRotating()) return;
        const timer = setInterval(() => activeIndex.update((i) => (i + 1) % count()), intervalMs);
        onCleanup(() => clearInterval(timer));
      },
      { injector: options.injector },
    );
  }

  return {
    activeIndex: activeIndex.asReadonly(),
    upcomingIndex,
    multi,
    next: () => {
      stopped.set(true);
      activeIndex.update((i) => (i + 1) % count());
    },
    previous: () => {
      stopped.set(true);
      activeIndex.update((i) => (i - 1 + count()) % count());
    },
    goTo: (index) => {
      stopped.set(true);
      activeIndex.set(index);
    },
    paused: paused.asReadonly(),
    stopped: stopped.asReadonly(),
    autoRotating,
    togglePaused: () => paused.update((p) => !p),
  };
}

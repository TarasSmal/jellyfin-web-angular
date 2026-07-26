import { Signal, computed, signal } from '@angular/core';
import { Chapter, chapterAt } from '@features/play-session';
import { formatClock } from '@shared/lib/clock';

/** Seconds per arrow-key press; matches the player's global shortcut. */
const ARROW_STEP_SECONDS = 10;
const PAGE_STEP_SECONDS = 60;

export interface ScrubTooltip {
  /** Where along the track to anchor, 0..1. */
  fraction: number;
  label: string;
}

export interface ScrubHost {
  /** Live playback position, seconds. */
  position: () => number;
  /** Item duration, seconds; 0 or less means not yet known. */
  duration: () => number;
  /** The hosted item's Chapters; empty when it has none. */
  chapters: () => readonly Chapter[];
  /** Receives exactly one seek per released drag or handled key press. */
  commit: (seconds: number) => void;
}

/**
 * The seek bar's brain, DOM-free: while a drag is in flight the bar displays
 * the drag position and a tooltip, and the host hears nothing; releasing
 * commits a single seek at the drop point. Keyboard presses are committed
 * intents, so each one seeks immediately. Inert until the duration is known.
 */
export interface ScrubInteraction {
  readonly dragging: Signal<boolean>;
  /** Drag position while dragging, live position otherwise. Seconds. */
  readonly displayPosition: Signal<number>;
  /** `displayPosition` as a 0..1 track fraction, for fills and thumbs. */
  readonly displayFraction: Signal<number>;
  readonly tooltip: Signal<ScrubTooltip | null>;
  /** Human-readable position for `aria-valuetext`. */
  readonly valueText: Signal<string>;
  /** Pointer over the track without a drag: tooltip only, never a seek. */
  hover(fraction: number): void;
  hoverEnd(): void;
  dragStart(fraction: number): void;
  dragMove(fraction: number): void;
  /** Release: commits the drag position, then resumes tracking live. */
  dragEnd(): void;
  /** Abandon without seeking (capture lost, focus gone). */
  dragCancel(): void;
  /** @returns true when the key seeked, so the caller swallows the event. */
  key(key: string): boolean;
}

export function createScrubInteraction(host: ScrubHost): ScrubInteraction {
  const dragFraction = signal<number | null>(null);
  const hoverFraction = signal<number | null>(null);

  const displayPosition = computed(() => {
    const fraction = dragFraction();
    return fraction === null ? host.position() : fraction * host.duration();
  });

  const displayFraction = computed(() => {
    const duration = host.duration();
    return duration > 0 ? clamp(displayPosition() / duration, 0, 1) : 0;
  });

  function commitAt(seconds: number): void {
    host.commit(clamp(seconds, 0, host.duration()));
  }

  /** "2:30 · The Heist" / "2:30, The Heist" — or just the clock outside any chapter. */
  function describe(seconds: number, separator: string): string {
    const chapter = chapterAt(host.chapters(), seconds);
    const clock = formatClock(seconds);
    return chapter ? `${clock}${separator}${chapter.name}` : clock;
  }

  return {
    dragging: computed(() => dragFraction() !== null),
    displayPosition,
    displayFraction,
    tooltip: computed(() => {
      const fraction = dragFraction() ?? hoverFraction();
      if (fraction === null) return null;
      return { fraction, label: describe(fraction * host.duration(), ' · ') };
    }),
    // Comma, not the visual middot: it reads as a natural pause.
    valueText: computed(() => describe(displayPosition(), ', ')),
    hover(fraction: number): void {
      if (host.duration() <= 0) return;
      hoverFraction.set(clamp(fraction, 0, 1));
    },
    hoverEnd(): void {
      hoverFraction.set(null);
    },
    dragStart(fraction: number): void {
      if (host.duration() <= 0) return;
      // The drag owns the pointer now; a stale hover must not resurface on release.
      hoverFraction.set(null);
      dragFraction.set(clamp(fraction, 0, 1));
    },
    dragMove(fraction: number): void {
      if (dragFraction() === null) return;
      dragFraction.set(clamp(fraction, 0, 1));
    },
    dragEnd(): void {
      const fraction = dragFraction();
      if (fraction === null) return;
      dragFraction.set(null);
      commitAt(fraction * host.duration());
    },
    dragCancel(): void {
      dragFraction.set(null);
    },
    key(key: string): boolean {
      if (host.duration() <= 0) return false;
      const from = displayPosition();
      switch (key) {
        case 'ArrowRight':
        case 'ArrowUp':
          commitAt(from + ARROW_STEP_SECONDS);
          return true;
        case 'ArrowLeft':
        case 'ArrowDown':
          commitAt(from - ARROW_STEP_SECONDS);
          return true;
        case 'PageUp':
          commitAt(from + PAGE_STEP_SECONDS);
          return true;
        case 'PageDown':
          commitAt(from - PAGE_STEP_SECONDS);
          return true;
        case 'Home':
          commitAt(0);
          return true;
        case 'End':
          commitAt(host.duration());
          return true;
        default:
          return false;
      }
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

import { DestroyRef, Signal, computed, effect, inject, signal, untracked } from '@angular/core';
import { BaseItemDto } from '@shared/api';

const COUNTDOWN_SECONDS = 10;
const DEFAULT_STILL_WATCHING_THRESHOLD = 3;

/** The Up Next card's visible state: the advertised episode and the timer. */
export interface UpNextState {
  /** Snapshot taken when the card arms; later refetches don't move it. */
  episode: BaseItemDto;
  /** Countdown counts down and auto-advances; confirm waits indefinitely. */
  mode: 'countdown' | 'confirm';
  secondsLeft: number;
}

/**
 * The host's ending policy as a state machine: idle → (episode ended) →
 * countdown → auto-advance, Play Now, or Cancel. Movies and series finales
 * skip the card and exit as before. After too many consecutive hands-off
 * auto-advances the countdown becomes an "Are you still watching?"
 * confirmation that never fires on its own.
 */
export interface UpNextPolicy {
  /** Non-null while the Up Next card should be on screen. */
  readonly state: Signal<UpNextState | null>;
  playNow(): void;
  cancel(): void;
  /** A deliberate gesture: proof the viewer is awake; resets the guard. */
  noteUserActivity(): void;
}

export interface UpNextOptions {
  /** Consecutive hands-off auto-advances before the confirm card. */
  stillWatchingThreshold?: number;
}

export interface UpNextHost {
  ended: () => boolean;
  item: () => BaseItemDto | undefined;
  next: () => BaseItemDto | undefined;
  neighborsLoading: () => boolean;
  advance: (episode: BaseItemDto) => void;
  exit: () => void;
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'deciding' }
  | { kind: 'countdown'; episode: BaseItemDto; secondsLeft: number }
  | { kind: 'confirm'; episode: BaseItemDto };

/** Create the policy in an injection context; its timer dies with the host. */
export function createUpNextPolicy(host: UpNextHost, options?: UpNextOptions): UpNextPolicy {
  const destroyRef = inject(DestroyRef);
  const threshold = options?.stillWatchingThreshold ?? DEFAULT_STILL_WATCHING_THRESHOLD;
  const phase = signal<Phase>({ kind: 'idle' });
  let timer: ReturnType<typeof setInterval> | null = null;
  // Arm only on ended's rising edge, so a stale ended=true carried across an
  // item change (effect-ordering race) can never trigger a second card.
  let prevEnded = false;
  // Consecutive timer-fired advances with no deliberate interaction in
  // between; deliberately NOT reset on item change, so it survives the binge.
  let handsOffAdvances = 0;

  function clearTimer(): void {
    if (timer !== null) clearInterval(timer);
    timer = null;
  }

  function toIdle(): void {
    clearTimer();
    phase.set({ kind: 'idle' });
  }

  function advanceTo(episode: BaseItemDto): void {
    toIdle();
    host.advance(episode);
  }

  function startCountdown(episode: BaseItemDto): void {
    phase.set({ kind: 'countdown', episode, secondsLeft: COUNTDOWN_SECONDS });
    timer = setInterval(() => {
      const current = phase();
      if (current.kind !== 'countdown') return;
      const secondsLeft = current.secondsLeft - 1;
      if (secondsLeft <= 0) {
        handsOffAdvances++;
        advanceTo(current.episode);
      } else phase.set({ ...current, secondsLeft });
    }, 1_000);
  }

  effect(() => {
    const ended = host.ended();
    const item = host.item();
    const loading = host.neighborsLoading();
    const next = host.next();

    if (!ended) {
      prevEnded = false;
      // The session rotated or restarted underneath us; whatever the card
      // advertised is moot.
      if (untracked(phase).kind !== 'idle') untracked(toIdle);
      return;
    }
    const rising = !prevEnded;
    prevEnded = true;

    untracked(() => {
      if (rising && item && phase().kind === 'idle') phase.set({ kind: 'deciding' });
      if (phase().kind !== 'deciding' || loading) return;
      if (next && handsOffAdvances >= threshold) phase.set({ kind: 'confirm', episode: next });
      else if (next) startCountdown(next);
      else {
        phase.set({ kind: 'idle' });
        host.exit();
      }
    });
  });

  destroyRef.onDestroy(clearTimer);

  return {
    state: computed(() => {
      const current = phase();
      if (current.kind === 'countdown')
        return { episode: current.episode, mode: 'countdown' as const, secondsLeft: current.secondsLeft };
      if (current.kind === 'confirm')
        return { episode: current.episode, mode: 'confirm' as const, secondsLeft: 0 };
      return null;
    }),
    playNow(): void {
      const current = phase();
      if (current.kind !== 'countdown' && current.kind !== 'confirm') return;
      handsOffAdvances = 0; // an explicit play is proof of life
      advanceTo(current.episode);
    },
    cancel(): void {
      const kind = phase().kind;
      if (kind !== 'countdown' && kind !== 'confirm') return;
      toIdle();
      host.exit();
    },
    noteUserActivity(): void {
      handsOffAdvances = 0;
    },
  };
}

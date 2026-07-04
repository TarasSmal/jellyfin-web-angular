import { DestroyRef, Signal, computed, effect, inject, signal, untracked } from '@angular/core';
import { BaseItemDto } from '@shared/api';

const COUNTDOWN_SECONDS = 10;

/** The Up Next card's visible state: the advertised episode and the timer. */
export interface UpNextState {
  /** Snapshot taken when the countdown starts; later refetches don't move it. */
  episode: BaseItemDto;
  secondsLeft: number;
}

/**
 * The host's ending policy as a state machine: idle → (episode ended) →
 * countdown → auto-advance, Play Now, or Cancel. Movies and series finales
 * skip the card and exit as before.
 */
export interface UpNextPolicy {
  /** Non-null while the Up Next card should be on screen. */
  readonly state: Signal<UpNextState | null>;
  playNow(): void;
  cancel(): void;
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
  | { kind: 'countdown'; episode: BaseItemDto; secondsLeft: number };

/** Create the policy in an injection context; its timer dies with the host. */
export function createUpNextPolicy(host: UpNextHost): UpNextPolicy {
  const destroyRef = inject(DestroyRef);
  const phase = signal<Phase>({ kind: 'idle' });
  let timer: ReturnType<typeof setInterval> | null = null;
  // Arm only on ended's rising edge, so a stale ended=true carried across an
  // item change (effect-ordering race) can never trigger a second card.
  let prevEnded = false;

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
      if (secondsLeft <= 0) advanceTo(current.episode);
      else phase.set({ ...current, secondsLeft });
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
      if (next) startCountdown(next);
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
      return current.kind === 'countdown'
        ? { episode: current.episode, secondsLeft: current.secondsLeft }
        : null;
    }),
    playNow(): void {
      const current = phase();
      if (current.kind === 'countdown') advanceTo(current.episode);
    },
    cancel(): void {
      if (phase().kind !== 'countdown') return;
      toIdle();
      host.exit();
    },
  };
}

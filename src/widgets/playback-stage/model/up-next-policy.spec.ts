import {
  EnvironmentInjector,
  createEnvironmentInjector,
  runInInjectionContext,
  signal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { BaseItemDto } from '@shared/api';
import { UpNextOptions, UpNextPolicy, createUpNextPolicy } from './up-next-policy';

function episode(id: string): BaseItemDto {
  return { Id: id, Name: `Episode ${id}`, Type: 'Episode' } as BaseItemDto;
}

describe('UpNextPolicy', () => {
  let scope: EnvironmentInjector | null;
  let ended: ReturnType<typeof signal<boolean>>;
  let item: ReturnType<typeof signal<BaseItemDto | undefined>>;
  let next: ReturnType<typeof signal<BaseItemDto | undefined>>;
  let neighborsLoading: ReturnType<typeof signal<boolean>>;
  let advance: ReturnType<typeof vi.fn<(episode: BaseItemDto) => void>>;
  let exit: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    TestBed.resetTestingModule();
    ended = signal(false);
    item = signal<BaseItemDto | undefined>(episode('ep-1'));
    next = signal<BaseItemDto | undefined>(undefined);
    neighborsLoading = signal(false);
    advance = vi.fn<(episode: BaseItemDto) => void>();
    exit = vi.fn<() => void>();
    scope = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
  });

  afterEach(() => {
    scope?.destroy();
    scope = null;
    vi.useRealTimers();
  });

  function create(options?: UpNextOptions): UpNextPolicy {
    if (!scope) throw new Error('scope destroyed');
    const policy = runInInjectionContext(scope, () =>
      createUpNextPolicy(
        {
          ended: () => ended(),
          item: () => item(),
          next: () => next(),
          neighborsLoading: () => neighborsLoading(),
          advance,
          exit,
        },
        options,
      ),
    );
    TestBed.tick();
    return policy;
  }

  /** Advance fake time and flush the effects the ticks scheduled. */
  function tick(ms: number): void {
    vi.advanceTimersByTime(ms);
    TestBed.tick();
  }

  /**
   * One hands-off cycle: the current episode ends, the countdown runs out,
   * and the host rotates to the advertised episode.
   */
  function handsOffCycle(advancedTo: string, nextUp: string): void {
    ended.set(true);
    TestBed.tick();
    tick(10_000); // countdown runs out → auto-advance
    item.set(episode(advancedTo));
    next.set(episode(nextUp));
    ended.set(false); // rotated session
    TestBed.tick();
  }

  it('shows a 10-second countdown on ended and auto-advances to the next episode', () => {
    next.set(episode('ep-2'));
    const policy = create();
    expect(policy.state()).toBeNull();

    ended.set(true);
    TestBed.tick();

    expect(policy.state()?.episode.Id).toBe('ep-2');
    expect(policy.state()?.secondsLeft).toBe(10);

    tick(9_000);
    expect(policy.state()?.secondsLeft).toBe(1);
    expect(advance).not.toHaveBeenCalled();

    tick(1_000);
    expect(advance).toHaveBeenCalledWith(expect.objectContaining({ Id: 'ep-2' }));
    expect(policy.state()).toBeNull();
    expect(exit).not.toHaveBeenCalled();
  });

  it('advances immediately on Play Now and never fires the timer', () => {
    next.set(episode('ep-2'));
    const policy = create();
    ended.set(true);
    TestBed.tick();

    policy.playNow();
    expect(advance).toHaveBeenCalledTimes(1);
    expect(policy.state()).toBeNull();

    tick(15_000);
    expect(advance).toHaveBeenCalledTimes(1); // countdown timer is dead
  });

  it('exits on Cancel without ever advancing', () => {
    next.set(episode('ep-2'));
    const policy = create();
    ended.set(true);
    TestBed.tick();

    policy.cancel();
    expect(exit).toHaveBeenCalledTimes(1);
    expect(policy.state()).toBeNull();

    tick(15_000);
    expect(advance).not.toHaveBeenCalled();
  });

  it('exits immediately with no card when there is no next episode', () => {
    const policy = create(); // next stays undefined: movie or series finale
    ended.set(true);
    TestBed.tick();

    expect(policy.state()).toBeNull();
    expect(exit).toHaveBeenCalledTimes(1);

    tick(15_000);
    expect(advance).not.toHaveBeenCalled();
  });

  it('holds the decision until neighbors finish loading', () => {
    neighborsLoading.set(true);
    const policy = create();
    ended.set(true);
    TestBed.tick();

    expect(policy.state()).toBeNull(); // not a finale verdict yet
    expect(exit).not.toHaveBeenCalled();

    next.set(episode('ep-2'));
    neighborsLoading.set(false);
    TestBed.tick();

    expect(policy.state()?.episode.Id).toBe('ep-2');
    expect(policy.state()?.secondsLeft).toBe(10);
  });

  it('keeps advertising and advances to the snapshot even if neighbors shift mid-countdown', () => {
    next.set(episode('ep-2'));
    const policy = create();
    ended.set(true);
    TestBed.tick();

    next.set(episode('ep-9'));
    TestBed.tick();
    expect(policy.state()?.episode.Id).toBe('ep-2');

    tick(10_000);
    expect(advance).toHaveBeenCalledWith(expect.objectContaining({ Id: 'ep-2' }));
  });

  it('arms once per ending: stale ended across an item change cannot re-trigger', () => {
    next.set(episode('ep-2'));
    const policy = create();
    ended.set(true);
    TestBed.tick();
    policy.playNow(); // host navigates to ep-2

    // Race window: the new item and its neighbors arrive while the session's
    // ended is still (stale) true.
    item.set(episode('ep-2'));
    next.set(episode('ep-3'));
    TestBed.tick();
    expect(policy.state()).toBeNull();
    expect(exit).not.toHaveBeenCalled();

    // The rotated session resets ended; the new episode later ends for real.
    ended.set(false);
    TestBed.tick();
    ended.set(true);
    TestBed.tick();
    expect(policy.state()?.episode.Id).toBe('ep-3');
  });

  it('dismisses the card when ended resets underneath it', () => {
    next.set(episode('ep-2'));
    const policy = create();
    ended.set(true);
    TestBed.tick();
    expect(policy.state()).not.toBeNull();

    ended.set(false); // session rotated or restarted
    TestBed.tick();

    expect(policy.state()).toBeNull();
    tick(15_000);
    expect(advance).not.toHaveBeenCalled();
  });

  it('asks "still watching?" with no timer after three hands-off auto-advances', () => {
    next.set(episode('ep-2'));
    const policy = create();

    handsOffCycle('ep-2', 'ep-3');
    handsOffCycle('ep-3', 'ep-4');
    handsOffCycle('ep-4', 'ep-5');
    expect(advance).toHaveBeenCalledTimes(3);

    // The fourth ending confirms instead of counting down.
    ended.set(true);
    TestBed.tick();
    expect(policy.state()?.mode).toBe('confirm');
    expect(policy.state()?.episode.Id).toBe('ep-5');

    tick(60_000); // waits indefinitely — no countdown runs
    expect(policy.state()?.mode).toBe('confirm');
    expect(advance).toHaveBeenCalledTimes(3);
    expect(exit).not.toHaveBeenCalled();
  });

  it('restores countdown behavior after Keep Watching, at a configurable threshold', () => {
    next.set(episode('ep-2'));
    const policy = create({ stillWatchingThreshold: 1 });

    handsOffCycle('ep-2', 'ep-3');
    ended.set(true);
    TestBed.tick();
    expect(policy.state()?.mode).toBe('confirm');

    policy.playNow(); // Keep Watching
    expect(advance).toHaveBeenCalledTimes(2);
    expect(advance).toHaveBeenLastCalledWith(expect.objectContaining({ Id: 'ep-3' }));

    // The counter reset: the next ending counts down again.
    item.set(episode('ep-3'));
    next.set(episode('ep-4'));
    ended.set(false);
    TestBed.tick();
    ended.set(true);
    TestBed.tick();
    expect(policy.state()?.mode).toBe('countdown');
    expect(policy.state()?.secondsLeft).toBe(10);
  });

  it('treats Play Now during a countdown as proof of life', () => {
    next.set(episode('ep-2'));
    const policy = create({ stillWatchingThreshold: 1 });

    handsOffCycle('ep-2', 'ep-3'); // counter at the threshold
    ended.set(true);
    TestBed.tick();
    expect(policy.state()?.mode).toBe('confirm');
    policy.playNow();

    // A countdown ending where the viewer presses Play Now before it fires…
    item.set(episode('ep-3'));
    next.set(episode('ep-4'));
    ended.set(false);
    TestBed.tick();
    ended.set(true);
    TestBed.tick();
    expect(policy.state()?.mode).toBe('countdown');
    tick(3_000);
    policy.playNow();

    // …keeps the following ending on countdown, not confirm.
    item.set(episode('ep-4'));
    next.set(episode('ep-5'));
    ended.set(false);
    TestBed.tick();
    ended.set(true);
    TestBed.tick();
    expect(policy.state()?.mode).toBe('countdown');
  });

  it('never nags an active viewer: user activity resets the guard', () => {
    next.set(episode('ep-2'));
    const policy = create({ stillWatchingThreshold: 1 });

    handsOffCycle('ep-2', 'ep-3'); // counter at the threshold
    policy.noteUserActivity(); // a key press mid-episode

    ended.set(true);
    TestBed.tick();
    expect(policy.state()?.mode).toBe('countdown');
  });

  it('exits from the confirmation without advancing', () => {
    next.set(episode('ep-2'));
    const policy = create({ stillWatchingThreshold: 1 });

    handsOffCycle('ep-2', 'ep-3');
    ended.set(true);
    TestBed.tick();
    expect(policy.state()?.mode).toBe('confirm');

    policy.cancel(); // Exit
    expect(exit).toHaveBeenCalledTimes(1);
    expect(policy.state()).toBeNull();
    expect(advance).toHaveBeenCalledTimes(1); // only the original auto-advance
  });

  it('tears the countdown timer down with the host', () => {
    next.set(episode('ep-2'));
    create();
    ended.set(true);
    TestBed.tick();

    scope?.destroy();
    scope = null;
    vi.advanceTimersByTime(15_000);

    expect(advance).not.toHaveBeenCalled();
  });
});

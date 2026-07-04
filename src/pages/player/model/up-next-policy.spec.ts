import {
  EnvironmentInjector,
  createEnvironmentInjector,
  runInInjectionContext,
  signal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { BaseItemDto } from '@shared/api';
import { UpNextPolicy, createUpNextPolicy } from './up-next-policy';

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

  function create(): UpNextPolicy {
    if (!scope) throw new Error('scope destroyed');
    const policy = runInInjectionContext(scope, () =>
      createUpNextPolicy({
        ended: () => ended(),
        item: () => item(),
        next: () => next(),
        neighborsLoading: () => neighborsLoading(),
        advance,
        exit,
      }),
    );
    TestBed.tick();
    return policy;
  }

  /** Advance fake time and flush the effects the ticks scheduled. */
  function tick(ms: number): void {
    vi.advanceTimersByTime(ms);
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

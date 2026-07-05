import { Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { createRotation } from './rotation';

describe('Rotation', () => {
  it('starts on the first slide and pre-renders the second', () => {
    const rotation = createRotation(signal(5));

    expect(rotation.activeIndex()).toBe(0);
    expect(rotation.upcomingIndex()).toBe(1);
  });

  it('advances forward and wraps from the last slide to the first', () => {
    const rotation = createRotation(signal(3));

    rotation.next();
    expect(rotation.activeIndex()).toBe(1);
    expect(rotation.upcomingIndex()).toBe(2);

    rotation.next();
    expect(rotation.activeIndex()).toBe(2);
    expect(rotation.upcomingIndex()).toBe(0);

    rotation.next();
    expect(rotation.activeIndex()).toBe(0);
  });

  it('goes back and wraps from the first slide to the last', () => {
    const rotation = createRotation(signal(3));

    rotation.previous();
    expect(rotation.activeIndex()).toBe(2);
    expect(rotation.upcomingIndex()).toBe(0);

    rotation.previous();
    expect(rotation.activeIndex()).toBe(1);
  });

  it('jumps straight to a chosen slide', () => {
    const rotation = createRotation(signal(5));

    rotation.goTo(3);
    expect(rotation.activeIndex()).toBe(3);
    expect(rotation.upcomingIndex()).toBe(4);
  });

  it('degrades with a single slide: nothing upcoming, controls hidden', () => {
    const rotation = createRotation(signal(1));

    expect(rotation.multi()).toBe(false);
    expect(rotation.upcomingIndex()).toBeNull();

    rotation.next();
    expect(rotation.activeIndex()).toBe(0);
  });

  it('shows controls when there is more than one slide', () => {
    const rotation = createRotation(signal(2));

    expect(rotation.multi()).toBe(true);
    expect(rotation.upcomingIndex()).toBe(1);
  });

  it('auto-advances on an interval, wrapping around', () => {
    vi.useFakeTimers();
    try {
      const rotation = createRotation(signal(3), { injector: TestBed.inject(Injector) });
      TestBed.tick(); // let the timer effect start

      vi.advanceTimersByTime(7000);
      expect(rotation.activeIndex()).toBe(1);

      vi.advanceTimersByTime(14_000);
      expect(rotation.activeIndex()).toBe(0); // wrapped 2 → 0
    } finally {
      vi.useRealTimers();
    }
  });

  it('pauses auto-rotation on toggle and resumes on the next toggle', () => {
    vi.useFakeTimers();
    try {
      const rotation = createRotation(signal(3), { injector: TestBed.inject(Injector) });
      TestBed.tick();

      rotation.togglePaused();
      expect(rotation.paused()).toBe(true);
      TestBed.tick();
      vi.advanceTimersByTime(14_000);
      expect(rotation.activeIndex()).toBe(0); // frozen while paused

      rotation.togglePaused();
      expect(rotation.paused()).toBe(false);
      TestBed.tick();
      vi.advanceTimersByTime(7000);
      expect(rotation.activeIndex()).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops auto-rotation permanently after any manual navigation', () => {
    vi.useFakeTimers();
    try {
      const rotation = createRotation(signal(3), { injector: TestBed.inject(Injector) });
      TestBed.tick();

      rotation.next(); // the viewer takes over
      expect(rotation.stopped()).toBe(true);
      TestBed.tick();
      vi.advanceTimersByTime(14_000);
      expect(rotation.activeIndex()).toBe(1); // no further automatic moves

      rotation.togglePaused(); // even un-pausing does not revive it
      rotation.togglePaused();
      TestBed.tick();
      vi.advanceTimersByTime(7000);
      expect(rotation.activeIndex()).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('holds still while the viewer hovers or focuses, then carries on', () => {
    vi.useFakeTimers();
    try {
      const held = signal(false);
      const rotation = createRotation(signal(3), { injector: TestBed.inject(Injector), held });
      TestBed.tick();

      held.set(true);
      TestBed.tick();
      vi.advanceTimersByTime(14_000);
      expect(rotation.activeIndex()).toBe(0);

      held.set(false);
      TestBed.tick();
      vi.advanceTimersByTime(7000);
      expect(rotation.activeIndex()).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('never auto-rotates when suppressed, but manual navigation still works', () => {
    vi.useFakeTimers();
    try {
      const rotation = createRotation(signal(3), {
        injector: TestBed.inject(Injector),
        autoRotate: false, // e.g. the viewer prefers reduced motion
      });
      TestBed.tick();

      expect(rotation.autoRotating()).toBe(false);
      vi.advanceTimersByTime(14_000);
      expect(rotation.activeIndex()).toBe(0);

      rotation.next();
      expect(rotation.activeIndex()).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('runs no timer for a single slide', () => {
    vi.useFakeTimers();
    try {
      const rotation = createRotation(signal(1), { injector: TestBed.inject(Injector) });
      TestBed.tick();

      expect(rotation.autoRotating()).toBe(false);
      vi.advanceTimersByTime(14_000);
      expect(rotation.activeIndex()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stays on a valid slide while the slide set changes size', () => {
    const count = signal(0);
    const rotation = createRotation(count);
    expect(rotation.upcomingIndex()).toBeNull();

    count.set(5); // slides arrive asynchronously
    expect(rotation.activeIndex()).toBe(0);
    expect(rotation.upcomingIndex()).toBe(1);

    rotation.goTo(4);
    count.set(2); // the set shrinks under the active slide
    expect(rotation.activeIndex()).toBe(1); // clamped to the new last slide
  });
});

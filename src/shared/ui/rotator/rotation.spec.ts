import { signal } from '@angular/core';
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

import { signal } from '@angular/core';
import { vi } from 'vitest';
import { Chapter } from '@features/play-session';
import { ScrubInteraction, createScrubInteraction } from './scrub-interaction';

describe('ScrubInteraction', () => {
  let position: ReturnType<typeof signal<number>>;
  let duration: ReturnType<typeof signal<number>>;
  let chapters: ReturnType<typeof signal<Chapter[]>>;
  let commit: ReturnType<typeof vi.fn<(seconds: number) => void>>;

  beforeEach(() => {
    position = signal(0);
    duration = signal(600);
    chapters = signal<Chapter[]>([]);
    commit = vi.fn<(seconds: number) => void>();
  });

  function create(): ScrubInteraction {
    return createScrubInteraction({
      position: () => position(),
      duration: () => duration(),
      chapters: () => chapters(),
      commit,
    });
  }

  it('displays the live position while no drag is in flight', () => {
    const scrub = create();
    position.set(90);
    expect(scrub.dragging()).toBe(false);
    expect(scrub.displayPosition()).toBe(90);
    expect(scrub.displayFraction()).toBeCloseTo(0.15);
    expect(scrub.tooltip()).toBeNull();
  });

  it('displays the drag position while dragging, ignoring live playback', () => {
    const scrub = create();
    scrub.dragStart(0.5);
    scrub.dragMove(0.25);
    position.set(599); // playback marches on underneath the drag
    expect(scrub.dragging()).toBe(true);
    expect(scrub.displayPosition()).toBe(150);
    expect(commit).not.toHaveBeenCalled();
  });

  it('shows a timestamp tooltip anchored at the drag point', () => {
    const scrub = create();
    scrub.dragStart(0.25);
    expect(scrub.tooltip()).toEqual({ fraction: 0.25, label: '2:30' });
  });

  it('commits exactly one seek, at the release position', () => {
    const scrub = create();
    scrub.dragStart(0.2);
    scrub.dragMove(0.4);
    scrub.dragMove(0.75);
    scrub.dragEnd();
    expect(commit).toHaveBeenCalledExactlyOnceWith(450);
  });

  it('resumes tracking live playback after release', () => {
    const scrub = create();
    scrub.dragStart(0.75);
    scrub.dragEnd();
    position.set(42);
    expect(scrub.dragging()).toBe(false);
    expect(scrub.displayPosition()).toBe(42);
    expect(scrub.tooltip()).toBeNull();
  });

  it('a second release without a drag commits nothing', () => {
    const scrub = create();
    scrub.dragStart(0.5);
    scrub.dragEnd();
    scrub.dragEnd();
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('cancelling abandons the drag without seeking', () => {
    const scrub = create();
    position.set(30);
    scrub.dragStart(0.9);
    scrub.dragCancel();
    expect(commit).not.toHaveBeenCalled();
    expect(scrub.displayPosition()).toBe(30);
  });

  it('a move without a start is ignored', () => {
    const scrub = create();
    scrub.dragMove(0.5);
    scrub.dragEnd();
    expect(scrub.dragging()).toBe(false);
    expect(commit).not.toHaveBeenCalled();
  });

  it('clamps drag fractions to the track', () => {
    const scrub = create();
    scrub.dragStart(1.4);
    expect(scrub.displayPosition()).toBe(600);
    scrub.dragMove(-0.2);
    scrub.dragEnd();
    expect(commit).toHaveBeenCalledExactlyOnceWith(0);
  });

  it('is inert while the duration is unknown', () => {
    duration.set(0);
    const scrub = create();
    scrub.dragStart(0.5);
    expect(scrub.dragging()).toBe(false);
    expect(scrub.key('ArrowRight')).toBe(false);
    scrub.dragEnd();
    expect(commit).not.toHaveBeenCalled();
  });

  it('arrow keys commit a step immediately, clamped to the track', () => {
    const scrub = create();
    position.set(595);
    expect(scrub.key('ArrowRight')).toBe(true);
    expect(commit).toHaveBeenLastCalledWith(600);
    position.set(5);
    expect(scrub.key('ArrowLeft')).toBe(true);
    expect(commit).toHaveBeenLastCalledWith(0);
    expect(commit).toHaveBeenCalledTimes(2);
  });

  it('page, Home, and End keys seek accordingly', () => {
    const scrub = create();
    position.set(300);
    scrub.key('PageUp');
    expect(commit).toHaveBeenLastCalledWith(360);
    scrub.key('PageDown');
    expect(commit).toHaveBeenLastCalledWith(240);
    scrub.key('Home');
    expect(commit).toHaveBeenLastCalledWith(0);
    scrub.key('End');
    expect(commit).toHaveBeenLastCalledWith(600);
  });

  it('leaves unrelated keys to the caller', () => {
    const scrub = create();
    expect(scrub.key(' ')).toBe(false);
    expect(scrub.key('f')).toBe(false);
    expect(commit).not.toHaveBeenCalled();
  });

  it('hovering shows a timestamp tooltip without seeking; leaving clears it', () => {
    const scrub = create();
    scrub.hover(0.5);
    expect(scrub.tooltip()).toEqual({ fraction: 0.5, label: '5:00' });
    expect(scrub.dragging()).toBe(false);
    scrub.hoverEnd();
    expect(scrub.tooltip()).toBeNull();
    expect(commit).not.toHaveBeenCalled();
  });

  it('a drag owns the tooltip; a stale hover does not resurface after release', () => {
    const scrub = create();
    scrub.hover(0.2);
    scrub.dragStart(0.6);
    expect(scrub.tooltip()).toEqual({ fraction: 0.6, label: '6:00' });
    scrub.dragEnd();
    expect(scrub.tooltip()).toBeNull();
  });

  it('the tooltip names the chapter containing the hovered or dragged point', () => {
    chapters.set([
      { name: 'Recap', startSeconds: 30 },
      { name: 'The Heist', startSeconds: 150 },
    ]);
    const scrub = create();
    scrub.hover(0.5);
    expect(scrub.tooltip()).toEqual({ fraction: 0.5, label: '5:00 · The Heist' });
    scrub.hover(0.25); // exactly on the chapter start
    expect(scrub.tooltip()?.label).toBe('2:30 · The Heist');
    scrub.dragStart(0.1);
    expect(scrub.tooltip()?.label).toBe('1:00 · Recap');
  });

  it('the tooltip stays time-only before the first chapter and on chapterless items', () => {
    chapters.set([{ name: 'Recap', startSeconds: 30 }]);
    const scrub = create();
    scrub.hover(0.01);
    expect(scrub.tooltip()?.label).toBe('0:06');
    chapters.set([]);
    scrub.hover(0.5);
    expect(scrub.tooltip()?.label).toBe('5:00');
  });

  it('formats the accessible value as a clock time', () => {
    const scrub = create();
    duration.set(7200);
    position.set(3725);
    expect(scrub.valueText()).toBe('1:02:05');
  });

  it('the accessible value names the current chapter', () => {
    chapters.set([
      { name: 'Recap', startSeconds: 30 },
      { name: 'The Heist', startSeconds: 150 },
    ]);
    const scrub = create();
    position.set(200);
    expect(scrub.valueText()).toBe('3:20, The Heist');
    scrub.dragStart(0.1); // announced value follows the drag, like the display
    expect(scrub.valueText()).toBe('1:00, Recap');
    position.set(10);
    scrub.dragCancel();
    expect(scrub.valueText()).toBe('0:10'); // before the first chapter
  });
});

import { MediaMatcher } from '@angular/cdk/layout';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Rotator } from './rotator';
import { RotatorSlide } from './rotator-slide';

@Component({
  imports: [Rotator, RotatorSlide],
  template: `
    <jf-rotator label="Featured">
      @for (name of names(); track name) {
        <p *jfRotatorSlide>{{ name }}</p>
      }
    </jf-rotator>
  `,
})
class Host {
  readonly names = signal(['one', 'two', 'three']);
}

describe('Rotator', () => {
  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
  });

  function create() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return fixture;
  }

  function slides(el: HTMLElement): HTMLElement[] {
    return Array.from(el.querySelectorAll<HTMLElement>('[aria-roledescription="slide"]'));
  }

  it('mounts only the active slide and the upcoming one, which stays hidden', () => {
    const el: HTMLElement = create().nativeElement;

    const mounted = slides(el);
    expect(mounted.map((s) => s.textContent?.trim())).toEqual(['one', 'two']);
    expect(mounted[0].getAttribute('aria-hidden')).toBeNull();
    expect(mounted[1].getAttribute('aria-hidden')).toBe('true');
    expect(mounted[1].hasAttribute('inert')).toBe(true);
  });

  it('advances on Next: the pre-rendered slide becomes active, a new one pre-renders', () => {
    vi.useFakeTimers();
    try {
      const fixture = create();
      const el: HTMLElement = fixture.nativeElement;

      el.querySelector<HTMLButtonElement>('button[aria-label="Next slide"]')?.click();
      fixture.detectChanges();
      vi.runAllTimers(); // let the outgoing slide finish its fade and unmount
      fixture.detectChanges();

      const mounted = slides(el);
      expect(mounted.map((s) => s.textContent?.trim())).toEqual(['two', 'three']);
      expect(mounted[0].getAttribute('aria-hidden')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('wraps backward: Previous on the first slide lands on the last', () => {
    vi.useFakeTimers();
    try {
      const fixture = create();
      const el: HTMLElement = fixture.nativeElement;

      el.querySelector<HTMLButtonElement>('button[aria-label="Previous slide"]')?.click();
      fixture.detectChanges();
      vi.runAllTimers();
      fixture.detectChanges();

      expect(slides(el).map((s) => s.textContent?.trim())).toEqual(['three', 'one']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('degrades to a static view with a single slide: no controls, no hidden twin', () => {
    const fixture = create();
    fixture.componentInstance.names.set(['only']);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(slides(el).map((s) => s.textContent?.trim())).toEqual(['only']);
    expect(el.querySelector('button')).toBeNull();
  });

  it('shows one dot per slide with an accessible name', () => {
    const el: HTMLElement = create().nativeElement;

    const dots = Array.from(el.querySelectorAll<HTMLButtonElement>('button[aria-label^="Go to slide"]'));
    expect(dots.map((d) => d.getAttribute('aria-label'))).toEqual([
      'Go to slide 1 of 3',
      'Go to slide 2 of 3',
      'Go to slide 3 of 3',
    ]);
  });

  it('marks the dot of the showing slide as current, following navigation', () => {
    vi.useFakeTimers();
    try {
      const fixture = create();
      const el: HTMLElement = fixture.nativeElement;
      const current = () =>
        el
          .querySelector<HTMLButtonElement>('button[aria-label^="Go to slide"][aria-current="true"]')
          ?.getAttribute('aria-label');

      expect(current()).toBe('Go to slide 1 of 3');

      el.querySelector<HTMLButtonElement>('button[aria-label="Next slide"]')?.click();
      fixture.detectChanges();
      vi.runAllTimers();
      fixture.detectChanges();

      expect(current()).toBe('Go to slide 2 of 3');
    } finally {
      vi.useRealTimers();
    }
  });

  it('jumps straight to a slide when its dot is activated', () => {
    vi.useFakeTimers();
    try {
      const fixture = create();
      const el: HTMLElement = fixture.nativeElement;

      el.querySelector<HTMLButtonElement>('button[aria-label="Go to slide 3 of 3"]')?.click();
      fixture.detectChanges();

      // Crossfade: the outgoing slide lingers under the incoming one, then unmounts.
      expect(slides(el).map((s) => s.textContent?.trim())).toContain('one');
      vi.runAllTimers();
      fixture.detectChanges();

      const mounted = slides(el);
      expect(mounted.map((s) => s.textContent?.trim())).toEqual(['three', 'one']);
      expect(mounted[0].getAttribute('aria-hidden')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('auto-advances with a crossfade after the rotation interval', () => {
    vi.useFakeTimers();
    try {
      const fixture = create();
      const el: HTMLElement = fixture.nativeElement;

      vi.advanceTimersByTime(7000);
      fixture.detectChanges();
      // Crossfade: the outgoing slide is still mounted beneath the new one.
      expect(slides(el).map((s) => s.textContent?.trim())).toContain('one');

      vi.advanceTimersByTime(500);
      fixture.detectChanges();
      const mounted = slides(el);
      expect(mounted.map((s) => s.textContent?.trim())).toEqual(['two', 'three']);
      expect(mounted[0].getAttribute('aria-hidden')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('pauses auto-rotation with the toggle and resumes on a second press', () => {
    vi.useFakeTimers();
    try {
      const fixture = create();
      const el: HTMLElement = fixture.nativeElement;
      const toggle = el.querySelector<HTMLButtonElement>('button[aria-label="Pause auto-rotation"]');
      expect(toggle?.getAttribute('aria-pressed')).toBe('false');

      toggle?.click();
      fixture.detectChanges();
      expect(toggle?.getAttribute('aria-pressed')).toBe('true');
      vi.advanceTimersByTime(14_000);
      fixture.detectChanges();
      expect(slides(el)[0].textContent?.trim()).toBe('one'); // frozen

      toggle?.click();
      fixture.detectChanges();
      vi.advanceTimersByTime(7500);
      fixture.detectChanges();
      expect(slides(el)[0].textContent?.trim()).toBe('two');
    } finally {
      vi.useRealTimers();
    }
  });

  it('holds rotation while the pointer hovers the billboard', () => {
    vi.useFakeTimers();
    try {
      const fixture = create();
      const el: HTMLElement = fixture.nativeElement;
      const region = el.querySelector('[aria-roledescription="carousel"]')!;

      region.dispatchEvent(new Event('mouseenter'));
      fixture.detectChanges();
      vi.advanceTimersByTime(14_000);
      fixture.detectChanges();
      expect(slides(el)[0].textContent?.trim()).toBe('one');

      region.dispatchEvent(new Event('mouseleave'));
      fixture.detectChanges();
      vi.advanceTimersByTime(7500);
      fixture.detectChanges();
      expect(slides(el)[0].textContent?.trim()).toBe('two');
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops auto-rotation for good once the viewer navigates manually', () => {
    vi.useFakeTimers();
    try {
      const fixture = create();
      const el: HTMLElement = fixture.nativeElement;

      el.querySelector<HTMLButtonElement>('button[aria-label="Next slide"]')?.click();
      fixture.detectChanges();
      vi.advanceTimersByTime(14_500);
      fixture.detectChanges();

      expect(slides(el)[0].textContent?.trim()).toBe('two'); // parked where they left it
      expect(el.querySelector('button[aria-label="Pause auto-rotation"]')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('never auto-rotates for viewers who prefer reduced motion', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        { provide: MediaMatcher, useValue: { matchMedia: () => ({ matches: true }) } },
      ],
    }).compileComponents();

    vi.useFakeTimers();
    try {
      const fixture = create();
      const el: HTMLElement = fixture.nativeElement;

      vi.advanceTimersByTime(14_000);
      fixture.detectChanges();
      expect(slides(el)[0].textContent?.trim()).toBe('one');
      expect(el.querySelector('button[aria-label="Pause auto-rotation"]')).toBeNull();

      el.querySelector<HTMLButtonElement>('button[aria-label="Next slide"]')?.click();
      fixture.detectChanges();
      expect(slides(el)[0].textContent?.trim()).toBe('two'); // manual still works
    } finally {
      vi.useRealTimers();
    }
  });

  it('announces slide changes politely only while auto-rotation is idle', () => {
    const fixture = create();
    const el: HTMLElement = fixture.nativeElement;
    const live = () => el.querySelector('[aria-live]')?.getAttribute('aria-live');

    expect(live()).toBe('off'); // silent while slides change on their own

    el.querySelector<HTMLButtonElement>('button[aria-label="Pause auto-rotation"]')?.click();
    fixture.detectChanges();
    expect(live()).toBe('polite');
  });

  it('sweeps a fill across the active dot over the rotation interval', () => {
    const el: HTMLElement = create().nativeElement;

    const fill = el.querySelector<HTMLElement>('.animate-dot-fill');
    expect(fill).not.toBeNull();
    expect(fill!.style.animationDuration).toBe('7000ms');
    expect(fill!.style.animationPlayState).toBe('running');
    expect(fill!.closest('button')?.getAttribute('aria-current')).toBe('true');
  });

  it('moves the fill to the next dot as auto-rotation advances', () => {
    vi.useFakeTimers();
    try {
      const fixture = create();
      const el: HTMLElement = fixture.nativeElement;

      vi.advanceTimersByTime(7000);
      fixture.detectChanges();

      const fill = el.querySelector<HTMLElement>('.animate-dot-fill');
      expect(fill!.closest('button')?.getAttribute('aria-label')).toBe('Go to slide 2 of 3');
    } finally {
      vi.useRealTimers();
    }
  });

  it('freezes the fill while hovered and restarts it from zero on leave', () => {
    vi.useFakeTimers();
    try {
      const fixture = create();
      const el: HTMLElement = fixture.nativeElement;
      const region = el.querySelector('[aria-roledescription="carousel"]')!;
      const frozen = el.querySelector<HTMLElement>('.animate-dot-fill')!;

      region.dispatchEvent(new Event('mouseenter'));
      fixture.detectChanges();
      expect(frozen.style.animationPlayState).toBe('paused');

      const nameWhileFrozen = frozen.style.animationName;
      region.dispatchEvent(new Event('mouseleave'));
      fixture.detectChanges();
      // The model restarts its full interval on resume, so the fill's
      // keyframe alias flips to restart the sweep from zero and stay in sync.
      expect(frozen.style.animationName).not.toBe(nameWhileFrozen);
      expect(frozen.style.animationPlayState).toBe('running');
    } finally {
      vi.useRealTimers();
    }
  });

  it('freezes the fill while paused via the toggle and restarts it on resume', () => {
    vi.useFakeTimers();
    try {
      const fixture = create();
      const el: HTMLElement = fixture.nativeElement;
      const toggle = el.querySelector<HTMLButtonElement>('button[aria-label="Pause auto-rotation"]');
      const frozen = el.querySelector<HTMLElement>('.animate-dot-fill')!;

      toggle?.click();
      fixture.detectChanges();
      expect(frozen.style.animationPlayState).toBe('paused');

      const nameWhileFrozen = frozen.style.animationName;
      toggle?.click();
      fixture.detectChanges();
      expect(frozen.style.animationName).not.toBe(nameWhileFrozen);
      expect(frozen.style.animationPlayState).toBe('running');
    } finally {
      vi.useRealTimers();
    }
  });

  it('drops the fill for good once the viewer navigates manually', () => {
    vi.useFakeTimers();
    try {
      const fixture = create();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.animate-dot-fill')).not.toBeNull();

      el.querySelector<HTMLButtonElement>('button[aria-label="Next slide"]')?.click();
      fixture.detectChanges();
      vi.runAllTimers();
      fixture.detectChanges();

      expect(el.querySelector('.animate-dot-fill')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('never shows a fill for viewers who prefer reduced motion', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        { provide: MediaMatcher, useValue: { matchMedia: () => ({ matches: true }) } },
      ],
    }).compileComponents();

    const el: HTMLElement = create().nativeElement;
    expect(el.querySelector('.animate-dot-fill')).toBeNull();
  });

  function swipe(
    region: Element,
    from: { x: number; y: number },
    to: { x: number; y: number },
    pointerType = 'touch',
  ) {
    region.dispatchEvent(
      new PointerEvent('pointerdown', { pointerId: 1, pointerType, clientX: from.x, clientY: from.y }),
    );
    region.dispatchEvent(
      new PointerEvent('pointerup', { pointerId: 1, pointerType, clientX: to.x, clientY: to.y }),
    );
  }

  it('advances on a leftward swipe and stops auto-rotation for good', () => {
    vi.useFakeTimers();
    try {
      const fixture = create();
      const el: HTMLElement = fixture.nativeElement;
      const region = el.querySelector('[aria-roledescription="carousel"]')!;

      swipe(region, { x: 300, y: 100 }, { x: 180, y: 110 });
      fixture.detectChanges();
      vi.runAllTimers();
      fixture.detectChanges();

      expect(slides(el)[0].textContent?.trim()).toBe('two');
      expect(el.querySelector('button[aria-label="Pause auto-rotation"]')).toBeNull();
      expect(el.querySelector('.animate-dot-fill')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('goes back on a rightward swipe, wrapping first to last', () => {
    vi.useFakeTimers();
    try {
      const fixture = create();
      const el: HTMLElement = fixture.nativeElement;
      const region = el.querySelector('[aria-roledescription="carousel"]')!;

      swipe(region, { x: 180, y: 100 }, { x: 300, y: 100 });
      fixture.detectChanges();
      vi.runAllTimers();
      fixture.detectChanges();

      expect(slides(el)[0].textContent?.trim()).toBe('three');
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores mostly-vertical drags so page scrolling is never hijacked', () => {
    const fixture = create();
    const el: HTMLElement = fixture.nativeElement;
    const region = el.querySelector('[aria-roledescription="carousel"]')!;

    swipe(region, { x: 300, y: 100 }, { x: 220, y: 300 });
    fixture.detectChanges();

    expect(slides(el)[0].textContent?.trim()).toBe('one');
  });

  it('treats short horizontal travel as a tap, not a swipe', () => {
    const fixture = create();
    const el: HTMLElement = fixture.nativeElement;
    const region = el.querySelector('[aria-roledescription="carousel"]')!;

    swipe(region, { x: 300, y: 100 }, { x: 270, y: 100 });
    fixture.detectChanges();

    expect(slides(el)[0].textContent?.trim()).toBe('one');
  });

  it('leaves mouse drags alone — swiping is for touch and pen', () => {
    const fixture = create();
    const el: HTMLElement = fixture.nativeElement;
    const region = el.querySelector('[aria-roledescription="carousel"]')!;

    swipe(region, { x: 300, y: 100 }, { x: 100, y: 100 }, 'mouse');
    fixture.detectChanges();

    expect(slides(el)[0].textContent?.trim()).toBe('one');
  });

  it('passes AXE checks', async () => {
    const fixture = create();
    const axe = (await import('axe-core')).default;

    const results = await axe.run(fixture.nativeElement, {
      rules: { 'color-contrast': { enabled: false } }, // jsdom cannot compute contrast
    });
    expect(results.violations).toEqual([]);
  });

  it('exposes the carousel structure to assistive tech', () => {
    const el: HTMLElement = create().nativeElement;

    const region = el.querySelector('[aria-roledescription="carousel"]');
    expect(region?.getAttribute('aria-label')).toBe('Featured');

    const mounted = slides(el);
    expect(mounted[0].getAttribute('role')).toBe('group');
    expect(mounted[0].getAttribute('aria-label')).toBe('1 of 3');
    expect(mounted[1].getAttribute('aria-label')).toBe('2 of 3');
  });
});

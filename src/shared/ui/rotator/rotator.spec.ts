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

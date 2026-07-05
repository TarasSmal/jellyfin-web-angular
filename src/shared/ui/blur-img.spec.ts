import { describe, expect, it, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { BlurImg } from './blur-img';

describe('BlurImg', () => {
  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [BlurImg] }).compileComponents();
  });

  function create(inputs: Record<string, unknown>) {
    const fixture = TestBed.createComponent(BlurImg);
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
    return fixture;
  }

  it('lazy-loads by default and hides the img until it loads', () => {
    const el: HTMLElement = create({ src: 'http://jf.test/a.webp' }).nativeElement;
    const img = el.querySelector('img');
    expect(img?.getAttribute('loading')).toBe('lazy');
    expect(img?.getAttribute('fetchpriority')).toBeNull();
    expect(img?.classList.contains('opacity-0')).toBe(true);
  });

  it('priority mode loads eagerly with fetchpriority=high', () => {
    const el: HTMLElement = create({
      src: 'http://jf.test/a.webp',
      priority: true,
    }).nativeElement;
    const img = el.querySelector('img');
    expect(img?.getAttribute('loading')).toBeNull();
    expect(img?.getAttribute('fetchpriority')).toBe('high');
  });

  it('fades the img in on load and hides it again for a new src', () => {
    const fixture = create({ src: 'http://jf.test/a.webp' });
    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;

    img.dispatchEvent(new Event('load'));
    fixture.detectChanges();
    expect(img.classList.contains('opacity-0')).toBe(false);

    fixture.componentRef.setInput('src', 'http://jf.test/b.webp');
    fixture.detectChanges();
    expect(img.classList.contains('opacity-0')).toBe(true);
  });

  it('hides the placeholder canvas when there is no hash', () => {
    const el: HTMLElement = create({ src: 'http://jf.test/a.webp' }).nativeElement;
    expect(el.querySelector('canvas')?.classList.contains('hidden')).toBe(true);
  });
});

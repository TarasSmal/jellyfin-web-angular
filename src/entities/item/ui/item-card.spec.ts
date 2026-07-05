import { describe, expect, it, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiConfig, BaseItemDto } from '@shared/api';
import { ItemCard } from './item-card';

const movie: BaseItemDto = {
  Id: 'm1',
  Name: 'The Copenhagen Test',
  Type: 'Movie',
  ProductionYear: 2024,
  CriticRating: 92,
  Studios: [{ Id: 's1', Name: 'NBC' }],
  ImageTags: { Primary: 'tag1' },
};

describe('ItemCard', () => {
  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ItemCard],
      providers: [provideRouter([])],
    }).compileComponents();
    TestBed.inject(ApiConfig).setServer('http://jf.test');
  });

  function createCard(item: BaseItemDto) {
    const fixture = TestBed.createComponent(ItemCard);
    fixture.componentRef.setInput('item', item);
    fixture.detectChanges();
    return fixture;
  }

  it('renders title and meta in the overlay without interaction', () => {
    const el: HTMLElement = createCard(movie).nativeElement;
    expect(el.textContent).toContain('The Copenhagen Test');
    expect(el.textContent).toContain('2024 · 92%');
  });

  it('marks the artwork as decorative', () => {
    const el: HTMLElement = createCard(movie).nativeElement;
    const artwork = el.querySelector<HTMLImageElement>('img.object-cover');
    expect(artwork?.getAttribute('alt')).toBe('');
  });

  it('shows the studio badge and hides it when the logo fails to load', () => {
    const fixture = createCard(movie);
    const el: HTMLElement = fixture.nativeElement;
    const badge = el.querySelector<HTMLImageElement>('img.drop-shadow-md');
    expect(badge?.src).toBe('http://jf.test/Studios/NBC/Images/Primary?maxHeight=96&quality=90&format=Webp');

    badge?.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(el.querySelector('img.drop-shadow-md')).toBeNull();
  });

  it('renders no badge when the item has no studio', () => {
    const el: HTMLElement = createCard({ ...movie, Studios: [] }).nativeElement;
    expect(el.querySelector('img.drop-shadow-md')).toBeNull();
  });
});

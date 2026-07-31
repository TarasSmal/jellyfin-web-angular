import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiConfig, BaseItemDto, ItemsResult } from '@shared/api';
import { LibraryBrowser } from './library-browser';

const item = (id: string): BaseItemDto => ({ Id: id, Name: id, Type: 'Movie' }) as BaseItemDto;
const page = (items: BaseItemDto[], total = items.length): ItemsResult => ({
  Items: items,
  TotalRecordCount: total,
});

/** Let the awaited firstValueFrom chain in fetchPage settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve));

describe('LibraryBrowser', () => {
  let http: HttpTestingController;
  let browser: LibraryBrowser;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), LibraryBrowser],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(ApiConfig).setServer('http://jf.test');
    TestBed.inject(ApiConfig).setSession('token', 'user-1');
    browser = TestBed.inject(LibraryBrowser);
  });

  afterEach(() => http.verify());

  it('starts pending so the grid shows skeletons before the first request lands', () => {
    expect(browser.loading()).toBe(true);
    expect(browser.items()).toEqual([]);
  });

  it('reset clears the previous library and stays pending', async () => {
    browser.init('lib-movies', 'Movie');
    http.expectOne((r) => r.url.includes('/Items')).flush(page([item('a'), item('b')]));
    await settle();
    browser.setParams({ genre: 'Comedy' });
    http.expectOne((r) => r.url.includes('/Items')).flush(page([item('a')]));
    await settle();
    expect(browser.items()).toHaveLength(1);
    expect(browser.loading()).toBe(false);

    browser.reset();

    expect(browser.items()).toEqual([]);
    expect(browser.total()).toBeNull();
    expect(browser.loading()).toBe(true); // skeletons, not an empty grid
    expect(browser.params().genre).toBeNull(); // filters don't leak across libraries
  });

  it('ignores a response that arrives after a reset', async () => {
    browser.init('lib-movies', 'Movie');
    const stale = http.expectOne((r) => r.url.includes('/Items'));

    browser.reset();
    stale.flush(page([item('a')]));
    await settle();

    expect(browser.items()).toEqual([]);
    expect(browser.loading()).toBe(true);
  });

  it('re-fetches when the same library is initialized again after a reset', async () => {
    browser.init('lib-movies', 'Movie');
    http.expectOne((r) => r.url.includes('/Items')).flush(page([item('a')]));
    await settle();

    browser.reset();
    browser.init('lib-movies', 'Movie');

    http.expectOne((r) => r.url.includes('/Items')).flush(page([item('a')]));
    await settle();
    expect(browser.items()).toHaveLength(1);
    expect(browser.loading()).toBe(false);
  });
});

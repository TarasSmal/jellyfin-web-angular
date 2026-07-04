import {
  EnvironmentInjector,
  createEnvironmentInjector,
  runInInjectionContext,
  signal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiConfig, BaseItemDto, ItemsResult } from '@shared/api';
import { EpisodeNeighbors, createEpisodeNeighbors } from './episode-neighbors';

function episode(id: string, seriesId = 'series-1'): BaseItemDto {
  return { Id: id, Name: `Episode ${id}`, Type: 'Episode', SeriesId: seriesId } as BaseItemDto;
}

function window(items: BaseItemDto[]): ItemsResult {
  return { Items: items, TotalRecordCount: items.length };
}

describe('EpisodeNeighbors', () => {
  let http: HttpTestingController;
  let scope: EnvironmentInjector | null;
  let item: ReturnType<typeof signal<BaseItemDto | undefined>>;

  beforeEach(() => {
    TestBed.resetTestingModule();
    item = signal<BaseItemDto | undefined>(undefined);
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    const config = TestBed.inject(ApiConfig);
    config.setServer('http://jf.test');
    config.setSession('token', 'user-1');
    scope = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
  });

  afterEach(() => {
    scope?.destroy();
    scope = null;
    http.verify();
  });

  function create(): EpisodeNeighbors {
    if (!scope) throw new Error('scope destroyed');
    const neighbors = runInInjectionContext(scope, () => createEpisodeNeighbors(() => item()));
    TestBed.tick();
    return neighbors;
  }

  /** Real macrotask drains microtasks (resource delivery) then flushes effects. */
  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
  }

  it('resolves both neighbors of a mid-series episode from the adjacency window', async () => {
    item.set(episode('ep-2'));
    const neighbors = create();

    http
      .expectOne(
        (r) =>
          r.url === 'http://jf.test/Shows/series-1/Episodes' &&
          r.params.get('adjacentTo') === 'ep-2' &&
          r.params.get('userId') === 'user-1',
      )
      .flush(window([episode('ep-1'), episode('ep-2'), episode('ep-3')]));
    await settle();

    expect(neighbors.previous()?.Id).toBe('ep-1');
    expect(neighbors.next()?.Id).toBe('ep-3');
  });

  it('stays inert for movies and undefined items', async () => {
    const neighbors = create();
    await settle();
    expect(neighbors.previous()).toBeUndefined();
    expect(neighbors.next()).toBeUndefined();
    expect(neighbors.loading()).toBe(false);

    item.set({ Id: 'movie-1', Name: 'Movie', Type: 'Movie' } as BaseItemDto);
    await settle();
    expect(neighbors.previous()).toBeUndefined();
    expect(neighbors.next()).toBeUndefined();
    // http.verify() in afterEach asserts no adjacency request was ever made
  });

  it('has no previous at the series premiere and no next at the finale', async () => {
    item.set(episode('ep-1'));
    const neighbors = create();
    http
      .expectOne((r) => r.params.get('adjacentTo') === 'ep-1')
      .flush(window([episode('ep-1'), episode('ep-2')]));
    await settle();
    expect(neighbors.previous()).toBeUndefined();
    expect(neighbors.next()?.Id).toBe('ep-2');

    item.set(episode('ep-9'));
    TestBed.tick();
    http
      .expectOne((r) => r.params.get('adjacentTo') === 'ep-9')
      .flush(window([episode('ep-8'), episode('ep-9')]));
    await settle();
    expect(neighbors.previous()?.Id).toBe('ep-8');
    expect(neighbors.next()).toBeUndefined();
  });

  it('exposes no neighbors when the window does not contain the current episode', async () => {
    item.set(episode('ep-2'));
    const neighbors = create();
    http
      .expectOne((r) => r.params.get('adjacentTo') === 'ep-2')
      .flush(window([episode('ep-7'), episode('ep-8')]));
    await settle();
    expect(neighbors.previous()).toBeUndefined();
    expect(neighbors.next()).toBeUndefined();
  });

  it('refetches the window when the hosted item changes', async () => {
    item.set(episode('ep-2'));
    const neighbors = create();
    http
      .expectOne((r) => r.params.get('adjacentTo') === 'ep-2')
      .flush(window([episode('ep-1'), episode('ep-2'), episode('ep-3')]));
    await settle();

    item.set(episode('ep-3'));
    TestBed.tick();
    expect(neighbors.loading()).toBe(true);
    http
      .expectOne((r) => r.params.get('adjacentTo') === 'ep-3')
      .flush(window([episode('ep-2'), episode('ep-3'), episode('ep-4')]));
    await settle();

    expect(neighbors.loading()).toBe(false);
    expect(neighbors.previous()?.Id).toBe('ep-2');
    expect(neighbors.next()?.Id).toBe('ep-4');
  });
});

import {
  EnvironmentInjector,
  createEnvironmentInjector,
  runInInjectionContext,
  signal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ApiConfig, BaseItemDto } from '@shared/api';
import { createArtworkWarmup } from './artwork-warmup';

function episode(id: string, tag = `tag-${id}`): BaseItemDto {
  return {
    Id: id,
    Name: `Episode ${id}`,
    Type: 'Episode',
    ImageTags: { Primary: tag },
  } as BaseItemDto;
}

describe('createArtworkWarmup', () => {
  let scope: EnvironmentInjector | null;
  let next: ReturnType<typeof signal<BaseItemDto | undefined>>;
  let fetched: string[];

  beforeEach(() => {
    TestBed.resetTestingModule();
    next = signal<BaseItemDto | undefined>(undefined);
    fetched = [];
    vi.stubGlobal(
      'Image',
      class {
        set src(url: string) {
          fetched.push(url);
        }
      },
    );
    const config = TestBed.inject(ApiConfig);
    config.setServer('http://jf.test');
    config.setSession('token', 'user-1');
    scope = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
  });

  afterEach(() => {
    scope?.destroy();
    scope = null;
    vi.unstubAllGlobals();
  });

  function create(): void {
    if (!scope) throw new Error('scope destroyed');
    runInInjectionContext(scope, () => createArtworkWarmup(() => next()));
    TestBed.tick();
  }

  it('fetches the queued episode thumbnail as soon as the neighbor is known', () => {
    create();
    expect(fetched).toEqual([]);

    next.set(episode('ep-6'));
    TestBed.tick();

    expect(fetched).toEqual([
      'http://jf.test/Items/ep-6/Images/Primary?tag=tag-ep-6&fillWidth=640&quality=90',
    ]);
  });

  it('warms each neighbor once, even when a refetch re-delivers the same episode', () => {
    create();
    next.set(episode('ep-6'));
    TestBed.tick();
    expect(fetched).toHaveLength(1);

    // Adjacency windows are refetched on item change; the same neighbor comes
    // back as a fresh object and must not hit the network again.
    next.set(episode('ep-6'));
    TestBed.tick();
    expect(fetched).toHaveLength(1);

    next.set(episode('ep-7'));
    TestBed.tick();
    expect(fetched).toHaveLength(2);
    expect(fetched[1]).toContain('/Items/ep-7/');
  });

  it('stays idle for a neighbor with no artwork', () => {
    create();
    next.set({ Id: 'ep-bare', Name: 'Bare', Type: 'Episode' } as BaseItemDto);
    TestBed.tick();
    expect(fetched).toEqual([]);
  });
});

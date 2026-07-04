import { EnvironmentInjector, createEnvironmentInjector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { ApiConfig } from './api-config';
import { JellyfinSocket, SocketMessage } from './socket';
import { NOTIFIER, injectMutation, liveResource } from './live-resource';
import { SessionInfo, VirtualFolderInfo } from './types';
import { virtualFoldersRequest } from './library-admin-api';

describe('liveResource', () => {
  let pushes: Subject<SocketMessage>;
  let connected: ReturnType<typeof signal<boolean>>;
  let socket: { messages$: Subject<SocketMessage>; connected: unknown; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> };
  let notifier: { show: ReturnType<typeof vi.fn> };
  let http: HttpTestingController;
  let scope: EnvironmentInjector | null;

  const session = (id: string): SessionInfo => ({ Id: id }) as SessionInfo;

  function destroyScope(): void {
    scope?.destroy();
    scope = null;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    pushes = new Subject<SocketMessage>();
    connected = signal(true);
    socket = { messages$: pushes, connected, start: vi.fn(), stop: vi.fn() };
    notifier = { show: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: JellyfinSocket, useValue: socket },
        { provide: NOTIFIER, useValue: notifier },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const config = TestBed.inject(ApiConfig);
    config.setServer('http://jf.test');
    config.setSession('token', 'user-1');
    scope = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
  });

  afterEach(() => {
    destroyScope();
    http.verify();
  });

  function create<T>(factory: () => T): T {
    if (!scope) throw new Error('scope already destroyed');
    const ref = runInInjectionContext(scope, factory);
    TestBed.tick();
    return ref;
  }

  /** httpResource applies responses in a microtask; yield before asserting. */
  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
  }

  describe('snapshot feed', () => {
    it('fetches once, then replaces the value from pushes without HTTP', async () => {
      const sessions = create(() => liveResource('sessions'));
      http.expectOne((r) => r.url === 'http://jf.test/Sessions').flush([session('s1')]);
      await settle();
      expect(sessions.value()?.[0].Id).toBe('s1');

      pushes.next({ MessageType: 'Sessions', Data: [session('s2')] });
      await settle();
      expect(sessions.value()?.[0].Id).toBe('s2');
      // no further HTTP — verified by http.verify() in afterEach
    });

    it('starts the wire feed on create and stops it on destroy', () => {
      create(() => liveResource('sessions'));
      http.expectOne((r) => r.url === 'http://jf.test/Sessions').flush([]);
      expect(socket.start).toHaveBeenCalledWith('Sessions');

      destroyScope();
      expect(socket.stop).toHaveBeenCalledWith('Sessions');
    });

    it('ignores unrelated messages and nullish payloads', async () => {
      const sessions = create(() => liveResource('sessions'));
      http.expectOne((r) => r.url === 'http://jf.test/Sessions').flush([session('s1')]);
      await settle();

      pushes.next({ MessageType: 'ScheduledTasksInfo', Data: [] });
      pushes.next({ MessageType: 'Sessions' });
      await settle();
      expect(sessions.value()?.[0].Id).toBe('s1');
    });
  });

  describe('invalidation feed', () => {
    async function createLibraries(throttleMs = 30) {
      const libraries = create(() =>
        liveResource<VirtualFolderInfo[]>(virtualFoldersRequest, { staleOn: 'library', throttleMs }),
      );
      http.expectOne((r) => r.url === 'http://jf.test/Library/VirtualFolders').flush([]);
      await settle();
      return libraries;
    }

    it('reloads on a stale event, throttling a burst to leading + trailing', async () => {
      await createLibraries();

      pushes.next({ MessageType: 'RefreshProgress' });
      pushes.next({ MessageType: 'LibraryChanged' });
      pushes.next({ MessageType: 'RefreshProgress' });
      await settle();
      http.expectOne((r) => r.url === 'http://jf.test/Library/VirtualFolders').flush([]); // leading

      await new Promise((resolve) => setTimeout(resolve, 60));
      await settle();
      http.expectOne((r) => r.url === 'http://jf.test/Library/VirtualFolders').flush([]); // trailing
      await settle();
    });

    it('ignores unrelated message types', async () => {
      await createLibraries();
      pushes.next({ MessageType: 'Sessions', Data: [] });
      await settle();
      // http.verify() in afterEach asserts no reload happened
    });

    it('reloads once when the socket reconnects', async () => {
      await createLibraries();

      connected.set(false);
      TestBed.tick();
      connected.set(true);
      await settle();
      http.expectOne((r) => r.url === 'http://jf.test/Library/VirtualFolders').flush([]);
      await settle();
    });
  });

  describe('unauthenticated', () => {
    it('stays idle when the request builder yields undefined', () => {
      TestBed.inject(ApiConfig).clearSession();
      const libraries = create(() => liveResource<VirtualFolderInfo[]>(virtualFoldersRequest));
      expect(libraries.value()).toBeUndefined();
      // no request — asserted by http.verify()
    });
  });

  describe('mutate', () => {
    it('toasts success and reloads, resolving true', async () => {
      const libraries = create(() => liveResource<VirtualFolderInfo[]>(virtualFoldersRequest));
      http.expectOne((r) => r.url === 'http://jf.test/Library/VirtualFolders').flush([]);
      await settle();

      const ok = await libraries.mutate(() => Promise.resolve(), 'Deleted “Movies”');
      expect(ok).toBe(true);
      expect(notifier.show).toHaveBeenCalledWith('Deleted “Movies”', 'info');
      await settle();
      http.expectOne((r) => r.url === 'http://jf.test/Library/VirtualFolders').flush([]);
    });

    it('toasts the default error and STILL reloads, resolving false', async () => {
      const libraries = create(() => liveResource<VirtualFolderInfo[]>(virtualFoldersRequest));
      http.expectOne((r) => r.url === 'http://jf.test/Library/VirtualFolders').flush([]);
      await settle();

      const ok = await libraries.mutate(() => Promise.reject(new Error('409')), 'Deleted');
      expect(ok).toBe(false);
      expect(notifier.show).toHaveBeenCalledWith('The server rejected the change');
      await settle();
      // the refetch-even-on-error invariant:
      http.expectOne((r) => r.url === 'http://jf.test/Library/VirtualFolders').flush([]);
    });

    it('uses a bespoke error message when given', async () => {
      const libraries = create(() => liveResource<VirtualFolderInfo[]>(virtualFoldersRequest));
      http.expectOne((r) => r.url === 'http://jf.test/Library/VirtualFolders').flush([]);
      await settle();

      await libraries.mutate(() => Promise.reject(new Error('x')), 'ok', "Couldn't delete it");
      expect(notifier.show).toHaveBeenCalledWith("Couldn't delete it");
      await settle();
      http.expectOne((r) => r.url === 'http://jf.test/Library/VirtualFolders').flush([]);
    });
  });

  describe('injectMutation', () => {
    it('runs the choreography with no refetch target', async () => {
      const run = create(() => injectMutation());

      await expect(run(() => Promise.resolve(), 'Server is restarting…')).resolves.toBe(true);
      expect(notifier.show).toHaveBeenCalledWith('Server is restarting…', 'info');

      await expect(run(() => Promise.reject(new Error('x')), 'ok')).resolves.toBe(false);
      expect(notifier.show).toHaveBeenCalledWith('The server rejected the change');
      // no HTTP at all — asserted by http.verify()
    });
  });
});

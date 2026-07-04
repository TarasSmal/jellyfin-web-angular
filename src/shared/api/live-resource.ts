import {
  HttpResourceRef,
  HttpResourceRequest,
  httpResource,
} from '@angular/common/http';
import { DestroyRef, InjectionToken, effect, inject, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, throttleTime } from 'rxjs';
import { ApiConfig } from './api-config';
import { JellyfinSocket, SocketFeed } from './socket';
import { sessionsRequest } from './sessions-api';
import { scheduledTasksRequest } from './tasks-api';
import { SessionInfo, TaskInfo } from './types';

/**
 * Notification port for mutation outcomes. shared/api must not depend on
 * shared/ui, so the app layer binds this token to ToastService (which
 * satisfies it structurally).
 */
export interface Notifier {
  show(message: string, kind?: 'error' | 'info'): void;
}
export const NOTIFIER = new InjectionToken<Notifier>('jf.notifier');

/**
 * Snapshot feeds: the server pushes the full new value over the socket and
 * the resource's value is replaced wholesale. Keys are domain names; the
 * wire feed/message names stay in this file.
 */
export interface FeedPayloads {
  sessions: SessionInfo[];
  tasks: TaskInfo[];
}
export type SnapshotFeed = keyof FeedPayloads;

/**
 * Invalidation topics: server events that mean "this read is stale" but
 * carry no usable payload. A topic may bundle several wire message types.
 */
export type StaleTopic = 'library';

export type RequestBuilder = (config: ApiConfig) => HttpResourceRequest | undefined;

export interface LiveResource<T> extends HttpResourceRef<T | undefined> {
  /**
   * Runs a server mutation with the standard choreography:
   * await action → success/error toast → reload this resource → resolve.
   *
   * Never throws; resolves false on rejection so pages can gate
   * success-only steps (close dialog, reset form) on the boolean.
   *
   * The reload fires on success AND on error: a rejected change may still
   * have altered server state, so the page re-reads either way. Pages whose
   * edits live in a draft that resets on reload (linkedSignal) must NOT use
   * this — a failed save would wipe the draft. Use injectMutation() there
   * and reload explicitly on success.
   */
  mutate(action: () => Promise<unknown>, success: string, error?: string): Promise<boolean>;
}

export type MutationRunner = (
  action: () => Promise<unknown>,
  success: string,
  error?: string,
) => Promise<boolean>;

const DEFAULT_ERROR = 'The server rejected the change';
const STALE_THROTTLE_MS = 2_000;

/** Domain name → wire feed. The feed's Start name doubles as its push MessageType. */
const SNAPSHOT_FEEDS: Record<SnapshotFeed, { wire: SocketFeed; request: RequestBuilder }> = {
  sessions: { wire: 'Sessions', request: (config) => sessionsRequest(config) },
  tasks: { wire: 'ScheduledTasksInfo', request: scheduledTasksRequest },
};

/** Domain topic → the unsolicited wire message types that mean "stale". */
const STALE_TOPICS: Record<StaleTopic, readonly string[]> = {
  library: ['RefreshProgress', 'LibraryChanged'],
};

/**
 * A server read that stays current via socket push instead of polling.
 *
 * Three call shapes:
 * - `liveResource('sessions')` — snapshot feed; the registry supplies the
 *   request builder and the payload type, pushes replace the value.
 * - `liveResource<T>(builder, { staleOn: 'library' })` — invalidation feed;
 *   matching events trigger a throttled reload, and the resource reloads
 *   once when the socket reconnects so nothing missed offline goes stale.
 * - `liveResource<T>(builder)` — plain resource, no socket; exists for the
 *   mutate() choreography.
 *
 * Must be called in an injection context; teardown (unsubscribe, refcounted
 * feed stop) binds to the caller's DestroyRef. Unauthenticated → the builder
 * returns undefined and the resource idles until a token appears. A reload
 * racing a snapshot push may briefly show the HTTP body; the next push
 * corrects it within the push interval.
 */
export function liveResource<F extends SnapshotFeed>(feed: F): LiveResource<FeedPayloads[F]>;
export function liveResource<T>(
  request: RequestBuilder,
  options?: { staleOn: StaleTopic; throttleMs?: number },
): LiveResource<T>;
export function liveResource(
  feedOrRequest: SnapshotFeed | RequestBuilder,
  options?: { staleOn: StaleTopic; throttleMs?: number },
): LiveResource<unknown> {
  const config = inject(ApiConfig);
  const notifier = inject(NOTIFIER);

  if (typeof feedOrRequest === 'string') {
    const { wire, request } = SNAPSHOT_FEEDS[feedOrRequest];
    const ref = httpResource<unknown>(() => request(config));
    const socket = inject(JellyfinSocket);
    socket.start(wire);
    inject(DestroyRef).onDestroy(() => socket.stop(wire));
    socket.messages$.pipe(takeUntilDestroyed()).subscribe((message) => {
      // The one cast from wire to registry type in the whole app.
      if (message.MessageType === wire && message.Data != null) ref.set(message.Data);
    });
    return withMutate(ref, notifier);
  }

  const ref = httpResource<unknown>(() => feedOrRequest(config));
  if (options) {
    const socket = inject(JellyfinSocket);
    const wireTypes = STALE_TOPICS[options.staleOn];
    socket.messages$
      .pipe(
        filter((message) => wireTypes.includes(message.MessageType)),
        throttleTime(options.throttleMs ?? STALE_THROTTLE_MS, undefined, {
          leading: true,
          trailing: true,
        }),
        takeUntilDestroyed(),
      )
      .subscribe(() => ref.reload());
    // Events missed while disconnected are gone; one reload on reconnect
    // guarantees the page can never stay stale.
    let wasConnected = untracked(socket.connected);
    effect(() => {
      const connected = socket.connected();
      if (connected && !wasConnected) ref.reload();
      wasConnected = connected;
    });
  }
  return withMutate(ref, notifier);
}

/**
 * Mutation choreography without a refetch target, for actions where there
 * is nothing to re-read (restart, shutdown, send-message) or where the page
 * owns reconciliation itself (draft pages that reload only on success).
 */
export function injectMutation(): MutationRunner {
  const notifier = inject(NOTIFIER);
  return (action, success, error) => runMutation(notifier, action, success, error);
}

function withMutate<T>(ref: HttpResourceRef<T | undefined>, notifier: Notifier): LiveResource<T> {
  return Object.assign(ref, {
    mutate: (action: () => Promise<unknown>, success: string, error?: string) =>
      runMutation(notifier, action, success, error, () => ref.reload()),
  });
}

async function runMutation(
  notifier: Notifier,
  action: () => Promise<unknown>,
  success: string,
  error?: string,
  refetch?: () => void,
): Promise<boolean> {
  let ok = true;
  try {
    await action();
    notifier.show(success, 'info');
  } catch {
    ok = false;
    notifier.show(error ?? DEFAULT_ERROR);
  }
  refetch?.();
  return ok;
}

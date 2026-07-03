import { Service, effect, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { ApiConfig } from './api-config';
import { getDeviceId } from '../lib/device-id';

export interface SocketMessage {
  MessageType: string;
  Data?: unknown;
}

/** Server-push feeds that need an explicit Start subscription. */
export type SocketFeed = 'Sessions' | 'ScheduledTasksInfo' | 'ActivityLogEntry';

const RECONNECT_DELAY_MS = 5_000;

/**
 * Jellyfin's /socket WebSocket: live session/task/library events instead of
 * polling. Connects whenever a token exists; resubscribes after reconnects.
 * Auth travels as api_key in the query string — sockets can't send headers.
 */
@Service()
export class JellyfinSocket {
  private readonly config = inject(ApiConfig);

  private ws: WebSocket | null = null;
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /** Feed -> consumer count; feeds restart automatically on reconnect. */
  private readonly feeds = new Map<SocketFeed, number>();

  private readonly _messages = new Subject<SocketMessage>();
  readonly messages$ = this._messages.asObservable();
  readonly connected = signal(false);

  constructor() {
    effect(() => {
      const url = this.config.serverUrl();
      const token = this.config.accessToken();
      if (url && token) this.connect(url, token);
      else this.disconnect();
    });
  }

  /** Subscribe to a pushed feed (refcounted across pages). */
  start(feed: SocketFeed, intervalMs = 1_500): void {
    this.feeds.set(feed, (this.feeds.get(feed) ?? 0) + 1);
    this.send(`${feed}Start`, `0,${intervalMs}`);
  }

  stop(feed: SocketFeed): void {
    const count = (this.feeds.get(feed) ?? 1) - 1;
    if (count > 0) {
      this.feeds.set(feed, count);
      return;
    }
    this.feeds.delete(feed);
    this.send(`${feed}Stop`);
  }

  private connect(serverUrl: string, token: string): void {
    this.teardown();
    // Jellyfin 12 expects `ApiKey` here — the older `api_key` gets a 403.
    const wsUrl = `${serverUrl.replace(/^http/, 'ws')}/socket?ApiKey=${encodeURIComponent(token)}&deviceId=${encodeURIComponent(getDeviceId())}`;
    const ws = new WebSocket(wsUrl);
    this.ws = ws;

    ws.onopen = () => {
      this.connected.set(true);
      for (const feed of this.feeds.keys()) this.send(`${feed}Start`, '0,1500');
    };

    ws.onmessage = (event) => {
      let message: SocketMessage;
      try {
        message = JSON.parse(event.data as string) as SocketMessage;
      } catch {
        return;
      }
      if (message.MessageType === 'ForceKeepAlive') {
        this.scheduleKeepAlive(Number(message.Data) || 60);
        return;
      }
      if (message.MessageType === 'KeepAlive') return;
      this._messages.next(message);
    };

    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.connected.set(false);
      this.ws = null;
      // Token may have been cleared while the close was in flight.
      if (this.config.isAuthenticated()) {
        this.reconnectTimer = setTimeout(() => this.connect(serverUrl, token), RECONNECT_DELAY_MS);
      }
    };
  }

  private disconnect(): void {
    this.teardown();
    this.connected.set(false);
  }

  private teardown(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
    this.reconnectTimer = null;
    this.keepAliveTimer = null;
    if (this.ws) {
      const ws = this.ws;
      this.ws = null;
      ws.onclose = null;
      ws.close();
    }
  }

  private scheduleKeepAlive(timeoutSeconds: number): void {
    if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
    this.send('KeepAlive');
    this.keepAliveTimer = setInterval(() => this.send('KeepAlive'), (timeoutSeconds * 1000) / 2);
  }

  private send(type: string, data?: string): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify(
        data === undefined ? { MessageType: type } : { MessageType: type, Data: data },
      ),
    );
  }
}

import { Component, DestroyRef, computed, inject } from '@angular/core';
import { httpResource } from '@angular/common/http';
import {
  ApiConfig,
  SessionInfo,
  SystemInfo,
  TaskInfo,
  scheduledTasksRequest,
  sessionsRequest,
  systemInfoRequest,
} from '@shared/api';
import { SessionCard } from '@entities/session';
import { itemPosterUrl } from '@entities/item';

const POLL_INTERVAL_MS = 10_000;

@Component({
  selector: 'app-admin-dashboard-page',
  imports: [SessionCard],
  template: `
    <main class="space-y-10">
      <header>
        <h1 class="text-2xl font-bold">Overview</h1>
        @if (info.value(); as system) {
          <p class="mt-1 text-sm text-text-muted">
            {{ system.ServerName }} · Jellyfin {{ system.Version }}
            @if (system.OperatingSystemDisplayName) {
              · {{ system.OperatingSystemDisplayName }}
            }
          </p>
          @if (system.HasPendingRestart) {
            <p class="mt-2 inline-block rounded-lg border border-danger px-3 py-1.5 text-sm text-danger">
              The server needs a restart to apply pending changes.
            </p>
          }
        } @else if (info.isLoading()) {
          <div class="mt-2 h-4 w-64 animate-pulse rounded bg-surface"></div>
        }
      </header>

      <section>
        <h2 class="mb-3 text-lg font-semibold">Now Playing</h2>
        @if (nowPlaying().length > 0) {
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            @for (session of nowPlaying(); track session.Id) {
              <app-session-card [session]="session" [posterUrl]="posterFor(session)" />
            }
          </div>
        } @else if (sessions.isLoading()) {
          <div class="h-24 animate-pulse rounded-xl bg-surface"></div>
        } @else {
          <p class="text-sm text-text-muted">Nothing is playing right now.</p>
        }
      </section>

      <section>
        <h2 class="mb-3 text-lg font-semibold">Active Devices</h2>
        @if (idleSessions().length > 0) {
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            @for (session of idleSessions(); track session.Id) {
              <app-session-card [session]="session" />
            }
          </div>
        } @else if (!sessions.isLoading()) {
          <p class="text-sm text-text-muted">No other devices connected.</p>
        }
      </section>

      <section>
        <h2 class="mb-3 text-lg font-semibold">Running Tasks</h2>
        @if (runningTasks().length > 0) {
          <ul class="space-y-3">
            @for (task of runningTasks(); track task.Id) {
              <li class="rounded-xl border border-border bg-surface p-3">
                <div class="flex items-baseline justify-between gap-3">
                  <p class="truncate font-medium">{{ task.Name }}</p>
                  <p class="shrink-0 text-sm text-text-muted">
                    {{ taskProgressLabel(task) }}
                  </p>
                </div>
                <div
                  class="mt-2 h-1 overflow-hidden rounded-full bg-surface-raised"
                  role="progressbar"
                  [attr.aria-label]="task.Name + ' progress'"
                  [attr.aria-valuenow]="taskProgress(task)"
                  aria-valuemin="0"
                  aria-valuemax="100"
                >
                  <div class="h-full rounded-full bg-accent" [style.width.%]="taskProgress(task)"></div>
                </div>
              </li>
            }
          </ul>
        } @else if (!tasks.isLoading()) {
          <p class="text-sm text-text-muted">No scheduled tasks are running.</p>
        }
      </section>
    </main>
  `,
})
export class AdminDashboardPage {
  private readonly config = inject(ApiConfig);

  protected readonly info = httpResource<SystemInfo>(() => systemInfoRequest(this.config));
  protected readonly sessions = httpResource<SessionInfo[]>(() => sessionsRequest(this.config));
  protected readonly tasks = httpResource<TaskInfo[]>(() => scheduledTasksRequest(this.config));

  constructor() {
    // Sessions and task progress go stale fast; WebSocket push is a later step.
    const poll = setInterval(() => {
      this.sessions.reload();
      this.tasks.reload();
    }, POLL_INTERVAL_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(poll));
  }

  protected readonly nowPlaying = computed(() =>
    (this.sessions.value() ?? []).filter((s) => s.NowPlayingItem),
  );

  /** Connected devices without playback; unnamed system sessions are noise. */
  protected readonly idleSessions = computed(() =>
    (this.sessions.value() ?? []).filter((s) => !s.NowPlayingItem && s.UserName),
  );

  protected readonly runningTasks = computed(() =>
    (this.tasks.value() ?? []).filter((t) => t.State !== 'Idle'),
  );

  protected posterFor(session: SessionInfo): string | null {
    const item = session.NowPlayingItem;
    return item ? itemPosterUrl(this.config, item, 160) : null;
  }

  protected taskProgress(task: TaskInfo): number {
    return Math.round(task.CurrentProgressPercentage ?? 0);
  }

  protected taskProgressLabel(task: TaskInfo): string {
    if (task.State === 'Cancelling') return 'Cancelling…';
    return `${this.taskProgress(task)}%`;
  }
}

import { Component, DestroyRef, computed, inject } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ApiConfig,
  FolderStorageDto,
  JellyfinSocket,
  SessionInfo,
  SessionsApi,
  SystemApi,
  SystemInfo,
  SystemStorageDto,
  TaskInfo,
  scheduledTasksRequest,
  sessionsRequest,
  systemInfoRequest,
  systemStorageRequest,
} from '@shared/api';
import { SessionCard } from '@entities/session';
import { itemPosterUrl } from '@entities/item';
import { formatBytes } from '@shared/lib/bytes';
import { ConfirmService } from '@shared/ui/confirm-dialog';
import { PromptService } from '@shared/ui/prompt-dialog';
import { ToastService } from '@shared/ui/toast';

@Component({
  selector: 'jf-admin-dashboard-page',
  imports: [SessionCard],
  templateUrl: './admin-dashboard-page.html',
})
export class AdminDashboardPage {
  private readonly config = inject(ApiConfig);
  private readonly systemApi = inject(SystemApi);
  private readonly sessionsApi = inject(SessionsApi);
  private readonly confirm = inject(ConfirmService);
  private readonly prompt = inject(PromptService);
  private readonly toast = inject(ToastService);

  protected readonly info = httpResource<SystemInfo>(() => systemInfoRequest(this.config));
  protected readonly storage = httpResource<SystemStorageDto>(() =>
    systemStorageRequest(this.config),
  );
  protected readonly sessions = httpResource<SessionInfo[]>(() => sessionsRequest(this.config));
  protected readonly tasks = httpResource<TaskInfo[]>(() => scheduledTasksRequest(this.config));

  constructor() {
    // Live updates: the socket pushes full session/task snapshots into the
    // resources; the initial HTTP fetch covers the gap before the first push.
    const socket = inject(JellyfinSocket);
    socket.start('Sessions');
    socket.start('ScheduledTasksInfo');
    socket.messages$.pipe(takeUntilDestroyed()).subscribe((message) => {
      if (message.MessageType === 'Sessions') this.sessions.set(message.Data as SessionInfo[]);
      if (message.MessageType === 'ScheduledTasksInfo') this.tasks.set(message.Data as TaskInfo[]);
    });
    inject(DestroyRef).onDestroy(() => {
      socket.stop('Sessions');
      socket.stop('ScheduledTasksInfo');
    });
  }

  protected readonly nowPlaying = computed(() =>
    (this.sessions.value() ?? []).filter((s) => s.NowPlayingItem),
  );

  /** Connected devices without playback; unnamed system sessions are noise. */
  protected readonly idleSessions = computed(() =>
    (this.sessions.value() ?? []).filter((s) => !s.NowPlayingItem && s.UserName),
  );

  protected readonly runningTasks = computed(() =>
    (this.tasks.value() ?? []).filter((t) => t.State !== 'Idle' && !t.IsHidden),
  );

  /** One entry per distinct disk: config, cache, and every library mount. */
  protected readonly storageFolders = computed<FolderStorageDto[] | undefined>(() => {
    const storage = this.storage.value();
    if (!storage) return undefined;
    const all = [
      storage.ProgramDataFolder,
      storage.CacheFolder,
      ...(storage.Libraries ?? []).flatMap((library) => library.Folders),
    ].filter((f): f is FolderStorageDto => !!f);
    const byDevice = new Map<string, FolderStorageDto>();
    for (const folder of all) {
      const device = folder.DeviceId ?? folder.Path;
      // Prefer the mount point itself as the representative path per disk.
      if (!byDevice.has(device) || folder.Path === device) byDevice.set(device, folder);
    }
    return [...byDevice.values()];
  });

  protected usedPercent(folder: FolderStorageDto): number {
    const total = folder.UsedSpace + folder.FreeSpace;
    return total > 0 ? Math.round((folder.UsedSpace / total) * 100) : 0;
  }

  protected freeLabel(folder: FolderStorageDto): string {
    return `${formatBytes(folder.FreeSpace)} free of ${formatBytes(folder.UsedSpace + folder.FreeSpace)}`;
  }

  protected posterFor(session: SessionInfo): string | null {
    const item = session.NowPlayingItem;
    return item ? itemPosterUrl(this.config, item, 160) : null;
  }

  protected async message(session: SessionInfo): Promise<void> {
    const text = await this.prompt.ask({
      title: `Message ${session.UserName ?? session.DeviceName}`,
      message: `Shown on ${session.Client} · ${session.DeviceName} for a few seconds.`,
      label: 'Message',
      confirmLabel: 'Send',
    });
    if (text === null) return;
    try {
      await this.sessionsApi.sendMessage(session.Id, text);
      this.toast.show('Message sent', 'info');
    } catch {
      this.toast.show("Couldn't deliver the message");
    }
  }

  protected async stopPlayback(session: SessionInfo): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: `Stop playback on ${session.DeviceName}?`,
      message: `${session.UserName} is watching ${session.NowPlayingItem?.Name}.`,
      confirmLabel: 'Stop playback',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await this.sessionsApi.stopPlayback(session.Id);
      this.toast.show('Playback stopped', 'info');
    } catch {
      this.toast.show("Couldn't stop playback");
    }
    this.sessions.reload();
  }

  protected async restart(): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Restart the server?',
      message: 'Everyone is disconnected while Jellyfin restarts. Usually takes under a minute.',
      confirmLabel: 'Restart',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await this.systemApi.restart();
      this.toast.show('Server is restarting…', 'info');
    } catch {
      this.toast.show("Couldn't restart the server");
    }
  }

  protected async shutdown(): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Shut down the server?',
      message:
        'Jellyfin stops until you start it again from the host — this page cannot power it back on.',
      confirmLabel: 'Shut down',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await this.systemApi.shutdown();
      this.toast.show('Server is shutting down…', 'info');
    } catch {
      this.toast.show("Couldn't shut down the server");
    }
  }

  protected taskProgress(task: TaskInfo): number {
    return Math.round(task.CurrentProgressPercentage ?? 0);
  }

  protected taskProgressLabel(task: TaskInfo): string {
    if (task.State === 'Cancelling') return 'Cancelling…';
    return `${this.taskProgress(task)}%`;
  }
}

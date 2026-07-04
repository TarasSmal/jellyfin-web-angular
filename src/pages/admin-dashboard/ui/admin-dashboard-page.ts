import { Component, computed, inject } from '@angular/core';
import { httpResource } from '@angular/common/http';
import {
  ApiConfig,
  FolderStorageDto,
  SessionInfo,
  SessionsApi,
  SystemApi,
  SystemInfo,
  SystemStorageDto,
  TaskInfo,
  injectMutation,
  liveResource,
  systemInfoRequest,
  systemStorageRequest,
} from '@shared/api';
import { SessionCard } from '@entities/session';
import { itemPosterUrl } from '@entities/item';
import { formatBytes } from '@shared/lib/bytes';
import { ConfirmService } from '@shared/ui/confirm-dialog';
import { PromptService } from '@shared/ui/prompt-dialog';

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

  protected readonly info = httpResource<SystemInfo>(() => systemInfoRequest(this.config));
  protected readonly storage = httpResource<SystemStorageDto>(() =>
    systemStorageRequest(this.config),
  );
  protected readonly sessions = liveResource('sessions');
  protected readonly tasks = liveResource('tasks');

  /** For actions with nothing to refetch (restart, shutdown, send-message). */
  private readonly run = injectMutation();

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
    await this.run(
      () => this.sessionsApi.sendMessage(session.Id, text),
      'Message sent',
      "Couldn't deliver the message",
    );
  }

  protected async stopPlayback(session: SessionInfo): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: `Stop playback on ${session.DeviceName}?`,
      message: `${session.UserName} is watching ${session.NowPlayingItem?.Name}.`,
      confirmLabel: 'Stop playback',
      danger: true,
    });
    if (!confirmed) return;
    await this.sessions.mutate(
      () => this.sessionsApi.stopPlayback(session.Id),
      'Playback stopped',
      "Couldn't stop playback",
    );
  }

  protected async restart(): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Restart the server?',
      message: 'Everyone is disconnected while Jellyfin restarts. Usually takes under a minute.',
      confirmLabel: 'Restart',
      danger: true,
    });
    if (!confirmed) return;
    await this.run(
      () => this.systemApi.restart(),
      'Server is restarting…',
      "Couldn't restart the server",
    );
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
    await this.run(
      () => this.systemApi.shutdown(),
      'Server is shutting down…',
      "Couldn't shut down the server",
    );
  }

  protected taskProgress(task: TaskInfo): number {
    return Math.round(task.CurrentProgressPercentage ?? 0);
  }

  protected taskProgressLabel(task: TaskInfo): string {
    if (task.State === 'Cancelling') return 'Cancelling…';
    return `${this.taskProgress(task)}%`;
  }
}

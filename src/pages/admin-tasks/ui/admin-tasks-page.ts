import { Component, DestroyRef, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiConfig, JellyfinSocket, TaskInfo, TasksApi, scheduledTasksRequest } from '@shared/api';
import { ToastService } from '@shared/ui/toast';

@Component({
  selector: 'jf-admin-tasks-page',
  imports: [DatePipe],
  templateUrl: './admin-tasks-page.html',
})
export class AdminTasksPage {
  private readonly config = inject(ApiConfig);
  private readonly api = inject(TasksApi);
  private readonly toast = inject(ToastService);

  protected readonly tasks = httpResource<TaskInfo[]>(() => scheduledTasksRequest(this.config));

  protected readonly groups = computed(() => {
    const all = this.tasks.value()?.filter((t) => !t.IsHidden);
    if (!all) return undefined;
    const byCategory = new Map<string, TaskInfo[]>();
    for (const task of all) {
      const category = task.Category ?? 'Other';
      byCategory.set(category, [...(byCategory.get(category) ?? []), task]);
    }
    return [...byCategory.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, tasks]) => ({
        category,
        tasks: tasks.slice().sort((a, b) => a.Name.localeCompare(b.Name)),
      }));
  });

  protected readonly skeletonRows = Array.from({ length: 8 }, (_, i) => i);

  constructor() {
    const socket = inject(JellyfinSocket);
    socket.start('ScheduledTasksInfo');
    socket.messages$.pipe(takeUntilDestroyed()).subscribe((message) => {
      if (message.MessageType === 'ScheduledTasksInfo') this.tasks.set(message.Data as TaskInfo[]);
    });
    inject(DestroyRef).onDestroy(() => socket.stop('ScheduledTasksInfo'));
  }

  protected progress(task: TaskInfo): number {
    return Math.round(task.CurrentProgressPercentage ?? 0);
  }

  protected lastRunFailed(task: TaskInfo): boolean {
    const status = task.LastExecutionResult?.Status;
    return task.State === 'Idle' && status !== undefined && status !== 'Completed';
  }

  protected async run(task: TaskInfo): Promise<void> {
    try {
      await this.api.runTask(task.Id);
      this.toast.show(`Started “${task.Name}”`, 'info');
    } catch {
      this.toast.show(`Couldn't start “${task.Name}”`);
    }
    this.tasks.reload();
  }

  protected async stop(task: TaskInfo): Promise<void> {
    try {
      await this.api.stopTask(task.Id);
      this.toast.show(`Stopping “${task.Name}”…`, 'info');
    } catch {
      this.toast.show(`Couldn't stop “${task.Name}”`);
    }
    this.tasks.reload();
  }
}

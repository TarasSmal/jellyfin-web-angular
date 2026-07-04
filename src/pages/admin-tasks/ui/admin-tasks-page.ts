import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TaskInfo, TasksApi, liveResource } from '@shared/api';

@Component({
  selector: 'jf-admin-tasks-page',
  imports: [DatePipe],
  templateUrl: './admin-tasks-page.html',
})
export class AdminTasksPage {
  private readonly api = inject(TasksApi);

  protected readonly tasks = liveResource('tasks');

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

  protected progress(task: TaskInfo): number {
    return Math.round(task.CurrentProgressPercentage ?? 0);
  }

  protected lastRunFailed(task: TaskInfo): boolean {
    const status = task.LastExecutionResult?.Status;
    return task.State === 'Idle' && status !== undefined && status !== 'Completed';
  }

  protected async run(task: TaskInfo): Promise<void> {
    await this.tasks.mutate(
      () => this.api.runTask(task.Id),
      `Started “${task.Name}”`,
      `Couldn't start “${task.Name}”`,
    );
  }

  protected async stop(task: TaskInfo): Promise<void> {
    await this.tasks.mutate(
      () => this.api.stopTask(task.Id),
      `Stopping “${task.Name}”…`,
      `Couldn't stop “${task.Name}”`,
    );
  }
}

import { Component, DestroyRef, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiConfig, JellyfinSocket, TaskInfo, TasksApi, scheduledTasksRequest } from '@shared/api';
import { ToastService } from '@shared/ui/toast';

@Component({
  selector: 'app-admin-tasks-page',
  imports: [DatePipe],
  template: `
    <main>
      <h1 class="text-2xl font-bold">Tasks</h1>
      <p class="mt-1 text-sm text-text-muted">Scheduled maintenance jobs on the server.</p>

      @if (groups(); as taskGroups) {
        <div class="mt-6 space-y-8">
          @for (group of taskGroups; track group.category) {
            <section>
              <h2 class="mb-3 text-lg font-semibold">{{ group.category }}</h2>
              <ul class="space-y-2">
                @for (task of group.tasks; track task.Id) {
                  <li class="rounded-xl border border-border bg-surface p-3">
                    <div class="flex items-center justify-between gap-3">
                      <div class="min-w-0">
                        <p class="truncate font-medium">{{ task.Name }}</p>
                        @if (task.Description) {
                          <p class="mt-0.5 truncate text-xs text-text-muted">{{ task.Description }}</p>
                        }
                        <p class="mt-0.5 text-xs" [class.text-danger]="lastRunFailed(task)" [class.text-text-faint]="!lastRunFailed(task)">
                          @if (task.State === 'Running') {
                            Running · {{ progress(task) }}%
                          } @else if (task.State === 'Cancelling') {
                            Cancelling…
                          } @else if (task.LastExecutionResult; as result) {
                            {{ result.Status ?? 'Ran' }} · {{ result.EndTimeUtc | date: 'MMM d, HH:mm' }}
                          } @else {
                            Never ran
                          }
                        </p>
                      </div>
                      @if (task.State === 'Idle') {
                        <button
                          type="button"
                          class="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm text-text-muted transition-colors hover:text-text"
                          (click)="run(task)"
                        >
                          Run
                        </button>
                      } @else {
                        <button
                          type="button"
                          class="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm text-danger transition-colors enabled:hover:border-danger disabled:opacity-40"
                          [disabled]="task.State === 'Cancelling'"
                          (click)="stop(task)"
                        >
                          Stop
                        </button>
                      }
                    </div>
                    @if (task.State === 'Running') {
                      <div
                        class="mt-2 h-1 overflow-hidden rounded-full bg-surface-raised"
                        role="progressbar"
                        [attr.aria-label]="task.Name + ' progress'"
                        [attr.aria-valuenow]="progress(task)"
                        aria-valuemin="0"
                        aria-valuemax="100"
                      >
                        <div class="h-full rounded-full bg-accent" [style.width.%]="progress(task)"></div>
                      </div>
                    }
                  </li>
                }
              </ul>
            </section>
          }
        </div>
      } @else if (tasks.isLoading()) {
        <div class="mt-6 space-y-2">
          @for (row of skeletonRows; track row) {
            <div class="h-16 animate-pulse rounded-xl bg-surface"></div>
          }
        </div>
      } @else if (tasks.error()) {
        <p class="mt-6 text-sm text-danger">Couldn't load scheduled tasks.</p>
      }
    </main>
  `,
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

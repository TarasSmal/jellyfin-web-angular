import { HttpClient, HttpResourceRequest } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiConfig } from './api-config';

/** All visible scheduled tasks with their run state. Admin-only endpoint. */
export function scheduledTasksRequest(config: ApiConfig): HttpResourceRequest | undefined {
  if (!config.isAuthenticated()) return undefined;
  return { url: config.url('/ScheduledTasks'), params: { isHidden: false } };
}

/** Start/stop scheduled tasks. */
@Service()
export class TasksApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ApiConfig);

  runTask(taskId: string): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(this.config.url(`/ScheduledTasks/Running/${taskId}`), null),
    );
  }

  stopTask(taskId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(this.config.url(`/ScheduledTasks/Running/${taskId}`)),
    );
  }
}

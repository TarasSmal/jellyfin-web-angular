import { HttpResourceRequest } from '@angular/common/http';
import { ApiConfig } from './api-config';

/** All visible scheduled tasks with their run state. Admin-only endpoint. */
export function scheduledTasksRequest(config: ApiConfig): HttpResourceRequest | undefined {
  if (!config.isAuthenticated()) return undefined;
  return { url: config.url('/ScheduledTasks'), params: { isHidden: false } };
}

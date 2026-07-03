import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ActivityLogResult, ApiConfig, LogSeverity, activityLogRequest } from '@shared/api';

const PAGE_SIZE = 25;

@Component({
  selector: 'jf-admin-activity-page',
  imports: [DatePipe],
  templateUrl: './admin-activity-page.html',
})
export class AdminActivityPage {
  private readonly config = inject(ApiConfig);

  protected readonly page = signal(0);

  protected readonly log = httpResource<ActivityLogResult>(() =>
    activityLogRequest(this.config, { startIndex: this.page() * PAGE_SIZE, limit: PAGE_SIZE }),
  );

  protected readonly isLastPage = computed(() => {
    const result = this.log.value();
    if (!result) return true;
    return (this.page() + 1) * PAGE_SIZE >= result.TotalRecordCount;
  });

  protected readonly rangeLabel = computed(() => {
    const result = this.log.value();
    if (!result || result.TotalRecordCount === 0) return '';
    const from = this.page() * PAGE_SIZE + 1;
    const to = Math.min((this.page() + 1) * PAGE_SIZE, result.TotalRecordCount);
    return `${from}–${to} of ${result.TotalRecordCount}`;
  });

  protected readonly skeletonRows = Array.from({ length: 8 }, (_, i) => i);

  protected isError(severity: LogSeverity): boolean {
    return severity === 'Error' || severity === 'Fatal';
  }

  protected previousPage(): void {
    this.page.update((p) => Math.max(0, p - 1));
  }

  protected nextPage(): void {
    if (!this.isLastPage()) this.page.update((p) => p + 1);
  }
}

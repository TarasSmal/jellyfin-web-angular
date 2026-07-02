import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import {
  ActivityLogResult,
  ApiConfig,
  LogSeverity,
  activityLogRequest,
} from '@shared/api';

const PAGE_SIZE = 25;

@Component({
  selector: 'app-admin-activity-page',
  imports: [DatePipe],
  template: `
    <main>
      <h1 class="text-2xl font-bold">Activity</h1>
      <p class="mt-1 text-sm text-text-muted">What happened on the server, newest first.</p>

      @if (log.value(); as result) {
        <div class="mt-6 overflow-x-auto rounded-xl border border-border">
          <table class="w-full text-left text-sm">
            <caption class="sr-only">Server activity log</caption>
            <thead class="border-b border-border bg-surface text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th scope="col" class="px-4 py-3 font-semibold">Time</th>
                <th scope="col" class="px-4 py-3 font-semibold">Severity</th>
                <th scope="col" class="px-4 py-3 font-semibold">Event</th>
              </tr>
            </thead>
            <tbody>
              @for (entry of result.Items; track entry.Id) {
                <tr class="border-b border-border/60 last:border-b-0">
                  <td class="whitespace-nowrap px-4 py-3 align-top text-text-muted">
                    {{ entry.Date | date: 'MMM d, HH:mm:ss' }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 align-top">
                    <span class="inline-flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        class="size-2 rounded-full"
                        [class.bg-danger]="isError(entry.Severity)"
                        [class.bg-warning]="entry.Severity === 'Warn'"
                        [class.bg-text-faint]="!isError(entry.Severity) && entry.Severity !== 'Warn'"
                      ></span>
                      <span [class.text-danger]="isError(entry.Severity)">{{ entry.Severity }}</span>
                    </span>
                  </td>
                  <td class="px-4 py-3 align-top">
                    <p>{{ entry.Name }}</p>
                    @if (entry.ShortOverview) {
                      <p class="mt-0.5 text-xs text-text-muted">{{ entry.ShortOverview }}</p>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="3" class="px-4 py-8 text-center text-text-muted">
                    No activity recorded yet.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <nav class="mt-4 flex items-center justify-between" aria-label="Activity log pages">
          <p class="text-sm text-text-muted">{{ rangeLabel() }}</p>
          <div class="flex gap-2">
            <button
              type="button"
              class="rounded-lg border border-border px-3 py-1.5 text-sm transition-colors enabled:hover:bg-surface-raised disabled:text-text-faint"
              [disabled]="page() === 0"
              (click)="previousPage()"
            >
              Previous
            </button>
            <button
              type="button"
              class="rounded-lg border border-border px-3 py-1.5 text-sm transition-colors enabled:hover:bg-surface-raised disabled:text-text-faint"
              [disabled]="isLastPage()"
              (click)="nextPage()"
            >
              Next
            </button>
          </div>
        </nav>
      } @else if (log.isLoading()) {
        <div class="mt-6 space-y-2">
          @for (row of skeletonRows; track row) {
            <div class="h-12 animate-pulse rounded-lg bg-surface"></div>
          }
        </div>
      } @else if (log.error()) {
        <p class="mt-6 text-sm text-danger">Couldn't load the activity log.</p>
      }
    </main>
  `,
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

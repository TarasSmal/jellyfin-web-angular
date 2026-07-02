import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ApiConfig, LogFile, logFileRequest, logFilesRequest } from '@shared/api';
import { formatBytes } from '@shared/lib/bytes';

@Component({
  selector: 'app-admin-logs-page',
  imports: [DatePipe],
  template: `
    <main>
      <h1 class="text-2xl font-bold">Logs</h1>
      <p class="mt-1 text-sm text-text-muted">Server log files, newest first.</p>

      <div class="mt-6 flex flex-col gap-4 lg:flex-row">
        <aside class="w-full shrink-0 lg:w-72">
          @if (sortedFiles(); as list) {
            <ul class="space-y-1">
              @for (file of list; track file.Name) {
                <li>
                  <button
                    type="button"
                    class="w-full rounded-lg border px-3 py-2 text-left transition-colors"
                    [class.border-accent]="file.Name === selected()"
                    [class.bg-surface-raised]="file.Name === selected()"
                    [class.border-border]="file.Name !== selected()"
                    [class.hover:bg-surface]="file.Name !== selected()"
                    [attr.aria-current]="file.Name === selected() ? 'true' : null"
                    (click)="selected.set(file.Name)"
                  >
                    <span class="block truncate font-mono text-xs">{{ file.Name }}</span>
                    <span class="mt-0.5 block text-xs text-text-faint">
                      {{ file.DateModified | date: 'MMM d, HH:mm' }} · {{ size(file) }}
                    </span>
                  </button>
                </li>
              } @empty {
                <li class="text-sm text-text-muted">No log files.</li>
              }
            </ul>
          } @else if (files.isLoading()) {
            <div class="h-24 animate-pulse rounded-xl bg-surface"></div>
          }
        </aside>

        <section class="min-w-0 flex-1">
          @if (selected()) {
            @if (content.value(); as text) {
              <pre
                class="max-h-[70dvh] overflow-auto rounded-xl border border-border bg-bg/80 p-4 font-mono text-xs leading-relaxed text-text-muted"
              >{{ text }}</pre>
            } @else if (content.isLoading()) {
              <div class="h-48 animate-pulse rounded-xl bg-surface"></div>
            } @else if (content.error()) {
              <p class="text-sm text-danger">Couldn't load this log file.</p>
            }
          } @else {
            <p class="rounded-xl border border-border bg-surface p-6 text-sm text-text-muted">
              Pick a log file to view it.
            </p>
          }
        </section>
      </div>
    </main>
  `,
})
export class AdminLogsPage {
  private readonly config = inject(ApiConfig);

  protected readonly files = httpResource<LogFile[]>(() => logFilesRequest(this.config));
  protected readonly sortedFiles = computed(() =>
    this.files.value()?.slice().sort((a, b) =>
      (b.DateModified ?? '').localeCompare(a.DateModified ?? ''),
    ),
  );

  protected readonly selected = signal<string>('');
  protected readonly content = httpResource.text(() =>
    logFileRequest(this.config, this.selected()),
  );

  protected size(file: LogFile): string {
    return formatBytes(file.Size);
  }
}

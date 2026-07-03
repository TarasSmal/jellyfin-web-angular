import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ApiConfig, LogFile, logFileRequest, logFilesRequest } from '@shared/api';
import { formatBytes } from '@shared/lib/bytes';

@Component({
  selector: 'jf-admin-logs-page',
  imports: [DatePipe],
  templateUrl: './admin-logs-page.html',
})
export class AdminLogsPage {
  private readonly config = inject(ApiConfig);

  protected readonly files = httpResource<LogFile[]>(() => logFilesRequest(this.config));
  protected readonly sortedFiles = computed(() =>
    this.files
      .value()
      ?.slice()
      .sort((a, b) => (b.DateModified ?? '').localeCompare(a.DateModified ?? '')),
  );

  protected readonly selected = signal<string>('');
  protected readonly content = httpResource.text(() =>
    logFileRequest(this.config, this.selected()),
  );

  protected size(file: LogFile): string {
    return formatBytes(file.Size);
  }
}

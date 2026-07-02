import { HttpResourceRequest } from '@angular/common/http';
import { ApiConfig } from './api-config';

/** Server log files on disk. Admin-only endpoint. */
export function logFilesRequest(config: ApiConfig): HttpResourceRequest | undefined {
  if (!config.isAuthenticated()) return undefined;
  return { url: config.url('/System/Logs') };
}

/** One log file's raw text (consume via httpResource.text). */
export function logFileRequest(config: ApiConfig, name: string): HttpResourceRequest | undefined {
  if (!config.isAuthenticated() || !name) return undefined;
  return { url: config.url('/System/Logs/Log'), params: { name } };
}

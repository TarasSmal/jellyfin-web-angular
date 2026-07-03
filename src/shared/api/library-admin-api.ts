import { HttpClient, HttpResourceRequest } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiConfig } from './api-config';
import { CollectionTypeOption } from './types';

/** All configured libraries with their media paths. Admin-only endpoint. */
export function virtualFoldersRequest(config: ApiConfig): HttpResourceRequest | undefined {
  if (!config.isAuthenticated()) return undefined;
  return { url: config.url('/Library/VirtualFolders') };
}

/** Admin mutations on libraries and their media paths. */
@Service()
export class LibraryAdminApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ApiConfig);

  createLibrary(
    name: string,
    collectionType: CollectionTypeOption,
    paths: string[],
  ): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(this.config.url('/Library/VirtualFolders'), null, {
        params: { name, collectionType, refreshLibrary: false, ...(paths.length ? { paths } : {}) },
      }),
    );
  }

  deleteLibrary(name: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(this.config.url('/Library/VirtualFolders'), {
        params: { name, refreshLibrary: false },
      }),
    );
  }

  addPath(libraryName: string, path: string): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(
        this.config.url('/Library/VirtualFolders/Paths'),
        { Name: libraryName, Path: path },
        { params: { refreshLibrary: true } },
      ),
    );
  }

  removePath(libraryName: string, path: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(this.config.url('/Library/VirtualFolders/Paths'), {
        params: { name: libraryName, path, refreshLibrary: true },
      }),
    );
  }

  /** Scan all libraries for new/changed files. */
  scanAllLibraries(): Promise<void> {
    return firstValueFrom(this.http.post<void>(this.config.url('/Library/Refresh'), null));
  }

  /** Scan one library (its folder ItemId from VirtualFolderInfo). */
  scanLibrary(itemId: string): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(this.config.url(`/Items/${itemId}/Refresh`), null, {
        params: { metadataRefreshMode: 'Default', imageRefreshMode: 'Default' },
      }),
    );
  }
}

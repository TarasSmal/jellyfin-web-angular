import { Component, computed, inject, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, throttleTime } from 'rxjs';
import { FormField, form, required } from '@angular/forms/signals';
import { BrnDialog, BrnDialogImports } from '@spartan-ng/brain/dialog';
import {
  ApiConfig,
  CollectionTypeOption,
  JellyfinSocket,
  LibraryAdminApi,
  VirtualFolderInfo,
  virtualFoldersRequest,
} from '@shared/api';
import { ConfirmService } from '@shared/ui/confirm-dialog';
import { PromptService } from '@shared/ui/prompt-dialog';
import { ToastService } from '@shared/ui/toast';

const COLLECTION_TYPES: { value: CollectionTypeOption; label: string }[] = [
  { value: 'movies', label: 'Movies' },
  { value: 'tvshows', label: 'TV Shows' },
  { value: 'music', label: 'Music' },
  { value: 'musicvideos', label: 'Music Videos' },
  { value: 'homevideos', label: 'Home Videos & Photos' },
  { value: 'boxsets', label: 'Collections' },
  { value: 'books', label: 'Books' },
  { value: 'mixed', label: 'Mixed Content' },
];

@Component({
  selector: 'jf-admin-libraries-page',
  imports: [FormField, BrnDialogImports],
  templateUrl: './admin-libraries-page.html',
})
export class AdminLibrariesPage {
  private readonly config = inject(ApiConfig);
  private readonly api = inject(LibraryAdminApi);
  private readonly confirm = inject(ConfirmService);
  private readonly prompt = inject(PromptService);
  private readonly toast = inject(ToastService);

  protected readonly libraries = httpResource<VirtualFolderInfo[]>(() =>
    virtualFoldersRequest(this.config),
  );
  protected readonly sortedLibraries = computed(() =>
    this.libraries
      .value()
      ?.slice()
      .sort((a, b) => a.Name.localeCompare(b.Name)),
  );

  protected readonly collectionTypes = COLLECTION_TYPES;
  protected readonly skeletonCards = Array.from({ length: 4 }, (_, i) => i);

  protected readonly creating = signal(false);
  private readonly newLibrary = signal({
    name: '',
    type: 'movies' as CollectionTypeOption,
    path: '',
  });
  protected readonly libraryForm = form(this.newLibrary, (library) => {
    required(library.name);
  });

  constructor() {
    // Scan progress arrives as pushed RefreshProgress/LibraryChanged events;
    // throttle because RefreshProgress fires many times per second mid-scan.
    inject(JellyfinSocket)
      .messages$.pipe(
        filter((m) => m.MessageType === 'RefreshProgress' || m.MessageType === 'LibraryChanged'),
        throttleTime(2_000, undefined, { leading: true, trailing: true }),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.libraries.reload());
  }

  protected typeLabel(type: CollectionTypeOption | undefined): string {
    return COLLECTION_TYPES.find((t) => t.value === type)?.label ?? 'Mixed Content';
  }

  protected async create(event: Event, dialog: BrnDialog): Promise<void> {
    event.preventDefault();
    if (!this.libraryForm().valid() || this.creating()) return;
    this.creating.set(true);
    const { name, type, path } = this.newLibrary();
    try {
      await this.api.createLibrary(name.trim(), type, path.trim() ? [path.trim()] : []);
      this.toast.show(`Created library “${name.trim()}”`, 'info');
      dialog.close();
      this.newLibrary.set({ name: '', type: 'movies', path: '' });
      this.libraries.reload();
    } catch {
      this.toast.show(`Couldn't create “${name.trim()}” — the server rejected it`);
    } finally {
      this.creating.set(false);
    }
  }

  protected async remove(library: VirtualFolderInfo): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: `Delete library “${library.Name}”?`,
      message:
        'Items and watch data for this library are removed from the server. Media files on disk are not touched.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!confirmed) return;
    await this.mutate(() => this.api.deleteLibrary(library.Name), `Deleted “${library.Name}”`);
  }

  protected async addPath(library: VirtualFolderInfo): Promise<void> {
    const path = await this.prompt.ask({
      title: `Add folder to “${library.Name}”`,
      message: 'The path must exist on the server and be readable by Jellyfin.',
      label: 'Path on the server',
      confirmLabel: 'Add folder',
    });
    if (path === null) return;
    await this.mutate(
      () => this.api.addPath(library.Name, path.trim()),
      `Added ${path.trim()} — scan started`,
    );
  }

  protected async removePath(library: VirtualFolderInfo, path: string): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: `Remove folder from “${library.Name}”?`,
      message: `${path} — its items are removed from the library; files on disk are not touched.`,
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!confirmed) return;
    await this.mutate(() => this.api.removePath(library.Name, path), `Removed ${path}`);
  }

  protected async scan(library: VirtualFolderInfo): Promise<void> {
    if (!library.ItemId) return;
    try {
      await this.api.scanLibrary(library.ItemId);
      this.toast.show(`Scanning “${library.Name}”…`, 'info');
    } catch {
      this.toast.show(`Couldn't start the scan of “${library.Name}”`);
    }
    this.libraries.reload();
  }

  protected async scanAll(): Promise<void> {
    try {
      await this.api.scanAllLibraries();
      this.toast.show('Scanning all libraries…', 'info');
    } catch {
      this.toast.show("Couldn't start the library scan");
    }
    this.libraries.reload();
  }

  private async mutate(action: () => Promise<void>, successMessage: string): Promise<void> {
    try {
      await action();
      this.toast.show(successMessage, 'info');
    } catch {
      this.toast.show('The server rejected the change');
    }
    this.libraries.reload();
  }
}

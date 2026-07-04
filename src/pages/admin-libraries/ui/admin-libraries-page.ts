import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form, required } from '@angular/forms/signals';
import { BrnDialog, BrnDialogImports } from '@spartan-ng/brain/dialog';
import {
  CollectionTypeOption,
  LibraryAdminApi,
  VirtualFolderInfo,
  liveResource,
  virtualFoldersRequest,
} from '@shared/api';
import { ConfirmService } from '@shared/ui/confirm-dialog';
import { PromptService } from '@shared/ui/prompt-dialog';

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
  private readonly api = inject(LibraryAdminApi);
  private readonly confirm = inject(ConfirmService);
  private readonly prompt = inject(PromptService);

  // Stays current with scan progress; the module throttles the event burst.
  protected readonly libraries = liveResource<VirtualFolderInfo[]>(virtualFoldersRequest, {
    staleOn: 'library',
  });
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

  protected typeLabel(type: CollectionTypeOption | undefined): string {
    return COLLECTION_TYPES.find((t) => t.value === type)?.label ?? 'Mixed Content';
  }

  protected async create(event: Event, dialog: BrnDialog): Promise<void> {
    event.preventDefault();
    if (!this.libraryForm().valid() || this.creating()) return;
    this.creating.set(true);
    const { name, type, path } = this.newLibrary();
    const ok = await this.libraries.mutate(
      () => this.api.createLibrary(name.trim(), type, path.trim() ? [path.trim()] : []),
      `Created library “${name.trim()}”`,
      `Couldn't create “${name.trim()}” — the server rejected it`,
    );
    if (ok) {
      dialog.close();
      this.newLibrary.set({ name: '', type: 'movies', path: '' });
    }
    this.creating.set(false);
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
    await this.libraries.mutate(
      () => this.api.deleteLibrary(library.Name),
      `Deleted “${library.Name}”`,
    );
  }

  protected async addPath(library: VirtualFolderInfo): Promise<void> {
    const path = await this.prompt.ask({
      title: `Add folder to “${library.Name}”`,
      message: 'The path must exist on the server and be readable by Jellyfin.',
      label: 'Path on the server',
      confirmLabel: 'Add folder',
    });
    if (path === null) return;
    await this.libraries.mutate(
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
    await this.libraries.mutate(() => this.api.removePath(library.Name, path), `Removed ${path}`);
  }

  protected async scan(library: VirtualFolderInfo): Promise<void> {
    const itemId = library.ItemId;
    if (!itemId) return;
    await this.libraries.mutate(
      () => this.api.scanLibrary(itemId),
      `Scanning “${library.Name}”…`,
      `Couldn't start the scan of “${library.Name}”`,
    );
  }

  protected async scanAll(): Promise<void> {
    await this.libraries.mutate(
      () => this.api.scanAllLibraries(),
      'Scanning all libraries…',
      "Couldn't start the library scan",
    );
  }
}

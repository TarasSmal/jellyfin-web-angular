import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { FormField, form, required } from '@angular/forms/signals';
import { BrnDialog, BrnDialogImports } from '@spartan-ng/brain/dialog';
import {
  ApiConfig,
  CollectionTypeOption,
  LibraryAdminApi,
  VirtualFolderInfo,
  virtualFoldersRequest,
} from '@shared/api';
import { ConfirmService } from '@shared/ui/confirm-dialog';
import { PromptService } from '@shared/ui/prompt-dialog';
import { ToastService } from '@shared/ui/toast';

const POLL_INTERVAL_MS = 10_000;

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
  selector: 'app-admin-libraries-page',
  imports: [FormField, BrnDialogImports],
  template: `
    <main>
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold">Libraries</h1>
          <p class="mt-1 text-sm text-text-muted">Media libraries and their folders on the server.</p>
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            class="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-surface-raised"
            (click)="scanAll()"
          >
            Scan all libraries
          </button>

          <brn-dialog #createDialog="brnDialog">
            <button
              brnDialogTrigger
              class="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
            >
              New library
            </button>
            <brn-dialog-overlay class="bg-black/60" />
            <div
              *brnDialogContent
              class="w-[min(92vw,26rem)] rounded-xl border border-border bg-surface-raised p-6 shadow-2xl"
            >
              <h2 brnDialogTitle class="text-lg font-semibold">New library</h2>
              <form class="mt-4 space-y-4" (submit)="create($event, createDialog)">
                <label class="block text-sm">
                  <span class="mb-1 block text-text-muted">Name</span>
                  <input
                    [formField]="libraryForm.name"
                    autocomplete="off"
                    class="w-full rounded-lg border border-border bg-surface px-3 py-2 focus:border-accent focus:outline-none"
                  />
                  @if (libraryForm.name().touched() && !libraryForm.name().valid()) {
                    <span class="mt-1 block text-xs text-danger">Name is required.</span>
                  }
                </label>
                <label class="block text-sm">
                  <span class="mb-1 block text-text-muted">Content type</span>
                  <select
                    [formField]="libraryForm.type"
                    class="w-full rounded-lg border border-border bg-surface px-3 py-2 focus:border-accent focus:outline-none"
                  >
                    @for (type of collectionTypes; track type.value) {
                      <option [value]="type.value">{{ type.label }}</option>
                    }
                  </select>
                </label>
                <label class="block text-sm">
                  <span class="mb-1 block text-text-muted">Folder path (optional)</span>
                  <input
                    [formField]="libraryForm.path"
                    autocomplete="off"
                    placeholder="/mnt/media/movies"
                    class="w-full rounded-lg border border-border bg-surface px-3 py-2 placeholder:text-text-faint focus:border-accent focus:outline-none"
                  />
                </label>
                <div class="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    brnDialogClose
                    class="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-surface"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    [disabled]="!libraryForm().valid() || creating()"
                    class="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
                  >
                    {{ creating() ? 'Creating…' : 'Create' }}
                  </button>
                </div>
              </form>
            </div>
          </brn-dialog>
        </div>
      </div>

      @if (sortedLibraries(); as list) {
        <div class="mt-6 grid gap-4 lg:grid-cols-2">
          @for (library of list; track library.Name) {
            <article class="rounded-xl border border-border bg-surface p-4">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <h2 class="truncate text-lg font-semibold">{{ library.Name }}</h2>
                  <p class="text-sm text-text-muted">
                    {{ typeLabel(library.CollectionType) }}
                    @if (library.RefreshStatus === 'Active') {
                      · Scanning {{ (library.RefreshProgress ?? 0).toFixed(0) }}%
                    }
                  </p>
                </div>
                <div class="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    class="rounded-lg border border-border px-2 py-1 text-xs text-text-muted transition-colors enabled:hover:text-text disabled:opacity-40"
                    [disabled]="!library.ItemId"
                    (click)="scan(library)"
                  >
                    Scan
                  </button>
                  <button
                    type="button"
                    class="rounded-lg border border-border px-2 py-1 text-xs text-danger transition-colors hover:border-danger"
                    (click)="remove(library)"
                  >
                    Delete
                  </button>
                </div>
              </div>

              @if (library.RefreshStatus === 'Active') {
                <div
                  class="mt-3 h-1 overflow-hidden rounded-full bg-surface-raised"
                  role="progressbar"
                  [attr.aria-label]="library.Name + ' scan progress'"
                  [attr.aria-valuenow]="(library.RefreshProgress ?? 0).toFixed(0)"
                  aria-valuemin="0"
                  aria-valuemax="100"
                >
                  <div class="h-full rounded-full bg-accent" [style.width.%]="library.RefreshProgress ?? 0"></div>
                </div>
              }

              <ul class="mt-3 space-y-1.5">
                @for (path of library.Locations; track path) {
                  <li class="flex items-center justify-between gap-2 rounded-lg bg-bg/60 px-3 py-1.5">
                    <code class="truncate text-xs text-text-muted">{{ path }}</code>
                    <button
                      type="button"
                      class="shrink-0 text-xs text-text-faint transition-colors hover:text-danger"
                      (click)="removePath(library, path)"
                    >
                      Remove
                    </button>
                  </li>
                } @empty {
                  <li class="rounded-lg bg-bg/60 px-3 py-1.5 text-xs text-text-faint">No folders yet.</li>
                }
              </ul>
              <button
                type="button"
                class="mt-2 text-xs text-accent transition-colors hover:text-accent-hover"
                (click)="addPath(library)"
              >
                + Add folder
              </button>
            </article>
          } @empty {
            <p class="text-sm text-text-muted lg:col-span-2">No libraries configured yet.</p>
          }
        </div>
      } @else if (libraries.isLoading()) {
        <div class="mt-6 grid gap-4 lg:grid-cols-2">
          @for (row of skeletonCards; track row) {
            <div class="h-36 animate-pulse rounded-xl bg-surface"></div>
          }
        </div>
      } @else if (libraries.error()) {
        <p class="mt-6 text-sm text-danger">Couldn't load libraries.</p>
      }
    </main>
  `,
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
    this.libraries.value()?.slice().sort((a, b) => a.Name.localeCompare(b.Name)),
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
    // Reflect scan progress (RefreshStatus/RefreshProgress) while the page is open.
    const poll = setInterval(() => this.libraries.reload(), POLL_INTERVAL_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(poll));
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
      message: 'Items and watch data for this library are removed from the server. Media files on disk are not touched.',
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

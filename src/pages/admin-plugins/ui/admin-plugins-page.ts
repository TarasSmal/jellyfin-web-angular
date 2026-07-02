import { Component, computed, inject, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import {
  ApiConfig,
  PackageInfo,
  PackageVersionInfo,
  PluginInfo,
  PluginStatus,
  PluginsApi,
  packagesRequest,
  pluginsRequest,
} from '@shared/api';
import { ConfirmService } from '@shared/ui/confirm-dialog';
import { ToastService } from '@shared/ui/toast';

/** Plugin ids and package guids differ only in dash/case conventions. */
function normalizeGuid(guid: string): string {
  return guid.replaceAll('-', '').toLowerCase();
}

@Component({
  selector: 'app-admin-plugins-page',
  template: `
    <main>
      <h1 class="text-2xl font-bold">Plugins</h1>
      <p class="mt-1 text-sm text-text-muted">Installed plugins and the catalog.</p>

      @if (needsRestart()) {
        <p class="mt-4 inline-block rounded-lg border border-warning px-3 py-1.5 text-sm text-warning">
          Restart the server (Overview → Restart) to finish plugin changes.
        </p>
      }

      <section class="mt-6">
        <h2 class="mb-3 text-lg font-semibold">Installed</h2>
        @if (plugins.value(); as installed) {
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            @for (plugin of installed; track plugin.Id + plugin.Version) {
              <article class="flex flex-col rounded-xl border border-border bg-surface p-4">
                <div class="flex items-start justify-between gap-2">
                  <h3 class="min-w-0 truncate font-medium">{{ plugin.Name }}</h3>
                  <span
                    class="shrink-0 rounded-full border px-2 py-0.5 text-xs"
                    [class.border-border]="statusKind(plugin.Status) === 'ok'"
                    [class.text-text-muted]="statusKind(plugin.Status) === 'ok'"
                    [class.border-warning]="statusKind(plugin.Status) === 'warn'"
                    [class.text-warning]="statusKind(plugin.Status) === 'warn'"
                    [class.border-danger]="statusKind(plugin.Status) === 'bad'"
                    [class.text-danger]="statusKind(plugin.Status) === 'bad'"
                  >
                    {{ plugin.Status }}
                  </span>
                </div>
                <p class="mt-0.5 text-xs text-text-faint">{{ plugin.Version }}</p>
                @if (plugin.Description) {
                  <p class="mt-2 line-clamp-2 text-sm text-text-muted">{{ plugin.Description }}</p>
                }
                @if (plugin.CanUninstall) {
                  <div class="mt-3 flex gap-1.5 pt-1">
                    <button
                      type="button"
                      class="rounded-lg border border-border px-2 py-1 text-xs text-text-muted transition-colors hover:text-text"
                      (click)="toggleEnabled(plugin)"
                    >
                      {{ plugin.Status === 'Disabled' ? 'Enable' : 'Disable' }}
                    </button>
                    <button
                      type="button"
                      class="rounded-lg border border-border px-2 py-1 text-xs text-danger transition-colors hover:border-danger"
                      (click)="uninstall(plugin)"
                    >
                      Uninstall
                    </button>
                  </div>
                } @else {
                  <p class="mt-3 pt-1 text-xs text-text-faint">Bundled with the server</p>
                }
              </article>
            } @empty {
              <p class="text-sm text-text-muted sm:col-span-2 xl:col-span-3">No plugins installed.</p>
            }
          </div>
        } @else if (plugins.isLoading()) {
          <div class="h-32 animate-pulse rounded-xl bg-surface"></div>
        } @else if (plugins.error()) {
          <p class="text-sm text-danger">Couldn't load installed plugins.</p>
        }
      </section>

      <section class="mt-10">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-lg font-semibold">Catalog</h2>
          <input
            type="search"
            placeholder="Filter catalog"
            class="w-56 rounded-full border border-border bg-surface px-4 py-1.5 text-sm placeholder:text-text-faint focus:border-accent focus:outline-none"
            [value]="filter()"
            (input)="onFilter($event)"
          />
        </div>
        @if (filteredPackages(); as catalog) {
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            @for (pkg of catalog; track pkg.guid) {
              <article class="flex flex-col rounded-xl border border-border bg-surface p-4">
                <div class="flex items-start justify-between gap-2">
                  <h3 class="min-w-0 truncate font-medium">{{ pkg.name }}</h3>
                  @if (pkg.category) {
                    <span class="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-text-muted">
                      {{ pkg.category }}
                    </span>
                  }
                </div>
                @if (latestVersion(pkg); as version) {
                  <p class="mt-0.5 text-xs text-text-faint">
                    {{ version.version }}
                    @if (pkg.owner) {
                      · by {{ pkg.owner }}
                    }
                  </p>
                }
                @if (pkg.description || pkg.overview) {
                  <p class="mt-2 line-clamp-3 text-sm text-text-muted">
                    {{ pkg.description || pkg.overview }}
                  </p>
                }
                <div class="mt-3 flex flex-1 items-end pt-1">
                  @if (installedGuids().has(normalizedGuid(pkg))) {
                    <span class="text-xs text-text-faint">Installed</span>
                  } @else {
                    <button
                      type="button"
                      class="rounded-lg border border-border px-2 py-1 text-xs text-text-muted transition-colors hover:text-text"
                      (click)="install(pkg)"
                    >
                      Install
                    </button>
                  }
                </div>
              </article>
            } @empty {
              <p class="text-sm text-text-muted sm:col-span-2 xl:col-span-3">
                Nothing in the catalog matches.
              </p>
            }
          </div>
        } @else if (packages.isLoading()) {
          <div class="h-32 animate-pulse rounded-xl bg-surface"></div>
        } @else if (packages.error()) {
          <p class="text-sm text-danger">Couldn't load the plugin catalog.</p>
        }
      </section>
    </main>
  `,
})
export class AdminPluginsPage {
  private readonly config = inject(ApiConfig);
  private readonly api = inject(PluginsApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly plugins = httpResource<PluginInfo[]>(() => pluginsRequest(this.config));
  protected readonly packages = httpResource<PackageInfo[]>(() => packagesRequest(this.config));

  protected readonly filter = signal('');

  protected readonly needsRestart = computed(() =>
    (this.plugins.value() ?? []).some((p) => p.Status === 'Restart'),
  );

  protected readonly installedGuids = computed(
    () => new Set((this.plugins.value() ?? []).map((p) => normalizeGuid(p.Id))),
  );

  protected readonly filteredPackages = computed(() => {
    const all = this.packages.value();
    if (!all) return undefined;
    const term = this.filter().trim().toLowerCase();
    const matches = term
      ? all.filter((p) =>
          [p.name, p.description, p.overview, p.category, p.owner]
            .filter(Boolean)
            .some((text) => (text as string).toLowerCase().includes(term)),
        )
      : all;
    return matches.slice().sort((a, b) => a.name.localeCompare(b.name));
  });

  protected normalizedGuid(pkg: PackageInfo): string {
    return normalizeGuid(pkg.guid);
  }

  protected latestVersion(pkg: PackageInfo): PackageVersionInfo | undefined {
    return pkg.versions[0];
  }

  protected statusKind(status: PluginStatus | undefined): 'ok' | 'warn' | 'bad' {
    if (status === 'Malfunctioned' || status === 'NotSupported' || status === 'Deleted') {
      return 'bad';
    }
    if (status === 'Restart' || status === 'Disabled') return 'warn';
    return 'ok';
  }

  protected onFilter(event: Event): void {
    this.filter.set((event.target as HTMLInputElement).value);
  }

  protected async toggleEnabled(plugin: PluginInfo): Promise<void> {
    const enable = plugin.Status === 'Disabled';
    if (!enable) {
      const confirmed = await this.confirm.ask({
        title: `Disable ${plugin.Name}?`,
        message: 'Takes effect after the next server restart.',
        confirmLabel: 'Disable',
        danger: true,
      });
      if (!confirmed) return;
    }
    try {
      await this.api.setEnabled(plugin.Id, plugin.Version, enable);
      this.toast.show(`${plugin.Name} ${enable ? 'enabled' : 'disabled'}`, 'info');
    } catch {
      this.toast.show(`Couldn't ${enable ? 'enable' : 'disable'} ${plugin.Name}`);
    }
    this.plugins.reload();
  }

  protected async uninstall(plugin: PluginInfo): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: `Uninstall ${plugin.Name}?`,
      message: 'The plugin and its settings are removed after the next server restart.',
      confirmLabel: 'Uninstall',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await this.api.uninstall(plugin.Id, plugin.Version);
      this.toast.show(`Uninstalled ${plugin.Name}`, 'info');
    } catch {
      this.toast.show(`Couldn't uninstall ${plugin.Name}`);
    }
    this.plugins.reload();
  }

  protected async install(pkg: PackageInfo): Promise<void> {
    const version = this.latestVersion(pkg);
    const confirmed = await this.confirm.ask({
      title: `Install ${pkg.name}?`,
      message: `Version ${version?.version ?? 'latest'} is downloaded from ${version?.repositoryName ?? 'the configured repository'}; a restart finishes the install.`,
      confirmLabel: 'Install',
    });
    if (!confirmed) return;
    try {
      await this.api.install(pkg.name, pkg.guid, version?.version);
      this.toast.show(`Installing ${pkg.name}…`, 'info');
    } catch {
      this.toast.show(`Couldn't start installing ${pkg.name}`);
    }
    this.plugins.reload();
  }
}

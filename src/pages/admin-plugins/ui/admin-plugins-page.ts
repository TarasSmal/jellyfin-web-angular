import { Component, computed, inject, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import {
  ApiConfig,
  PackageInfo,
  PackageVersionInfo,
  PluginInfo,
  PluginStatus,
  PluginsApi,
  liveResource,
  packagesRequest,
  pluginsRequest,
} from '@shared/api';
import { ConfirmService } from '@shared/ui/confirm-dialog';

/** Plugin ids and package guids differ only in dash/case conventions. */
function normalizeGuid(guid: string): string {
  return guid.replaceAll('-', '').toLowerCase();
}

@Component({
  selector: 'jf-admin-plugins-page',
  templateUrl: './admin-plugins-page.html',
})
export class AdminPluginsPage {
  private readonly config = inject(ApiConfig);
  private readonly api = inject(PluginsApi);
  private readonly confirm = inject(ConfirmService);

  protected readonly plugins = liveResource<PluginInfo[]>(pluginsRequest);
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
    await this.plugins.mutate(
      () => this.api.setEnabled(plugin.Id, plugin.Version, enable),
      `${plugin.Name} ${enable ? 'enabled' : 'disabled'}`,
      `Couldn't ${enable ? 'enable' : 'disable'} ${plugin.Name}`,
    );
  }

  protected async uninstall(plugin: PluginInfo): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: `Uninstall ${plugin.Name}?`,
      message: 'The plugin and its settings are removed after the next server restart.',
      confirmLabel: 'Uninstall',
      danger: true,
    });
    if (!confirmed) return;
    await this.plugins.mutate(
      () => this.api.uninstall(plugin.Id, plugin.Version),
      `Uninstalled ${plugin.Name}`,
      `Couldn't uninstall ${plugin.Name}`,
    );
  }

  protected async install(pkg: PackageInfo): Promise<void> {
    const version = this.latestVersion(pkg);
    const confirmed = await this.confirm.ask({
      title: `Install ${pkg.name}?`,
      message: `Version ${version?.version ?? 'latest'} is downloaded from ${version?.repositoryName ?? 'the configured repository'}; a restart finishes the install.`,
      confirmLabel: 'Install',
    });
    if (!confirmed) return;
    await this.plugins.mutate(
      () => this.api.install(pkg.name, pkg.guid, version?.version),
      `Installing ${pkg.name}…`,
      `Couldn't start installing ${pkg.name}`,
    );
  }
}

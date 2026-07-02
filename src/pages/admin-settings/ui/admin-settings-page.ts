import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import {
  ApiConfig,
  CountryInfo,
  CultureDto,
  LocalizationOption,
  ServerConfiguration,
  SystemConfigApi,
  countriesRequest,
  culturesRequest,
  localizationOptionsRequest,
  systemConfigRequest,
} from '@shared/api';
import { ToastService } from '@shared/ui/toast';

interface ConfigToggle {
  key: string;
  label: string;
  hint?: string;
}

interface ConfigNumber {
  key: string;
  label: string;
  hint?: string;
  min: number;
  max: number;
}

const DISPLAY_TOGGLES: ConfigToggle[] = [
  {
    key: 'EnableGroupingMoviesIntoCollections',
    label: 'Group movies into collections',
    hint: 'Movie lists show one entry per collection',
  },
  {
    key: 'EnableGroupingShowsIntoCollections',
    label: 'Group shows into collections',
  },
  {
    key: 'DisplaySpecialsWithinSeasons',
    label: 'Show specials within seasons',
    hint: 'Specials appear inside the season they aired in',
  },
];

const RESUME_NUMBERS: ConfigNumber[] = [
  {
    key: 'MinResumePct',
    label: 'Minimum resume percentage',
    hint: 'Watched less than this counts as unplayed',
    min: 0,
    max: 100,
  },
  {
    key: 'MaxResumePct',
    label: 'Maximum resume percentage',
    hint: 'Watched more than this counts as fully played',
    min: 0,
    max: 100,
  },
  {
    key: 'MinResumeDurationSeconds',
    label: 'Minimum resume duration (seconds)',
    hint: 'Shorter titles never register resume points',
    min: 0,
    max: 3600,
  },
];

const RETENTION_NUMBERS: ConfigNumber[] = [
  {
    key: 'ActivityLogRetentionDays',
    label: 'Activity log retention (days)',
    min: 1,
    max: 3650,
  },
  {
    key: 'LogFileRetentionDays',
    label: 'Log file retention (days)',
    min: 1,
    max: 3650,
  },
];

@Component({
  selector: 'app-admin-settings-page',
  template: `
    <main>
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold">Settings</h1>
          <p class="mt-1 text-sm text-text-muted">General server configuration.</p>
        </div>
        <button
          type="button"
          [disabled]="saving() || !draft()"
          class="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          (click)="save()"
        >
          {{ saving() ? 'Saving…' : 'Save changes' }}
        </button>
      </div>

      @if (draft(); as current) {
        <div class="mt-6 grid gap-6 lg:grid-cols-2">
          <section class="rounded-xl border border-border bg-surface p-4">
            <h2 class="mb-3 text-lg font-semibold">General</h2>
            <label class="block text-sm">
              <span class="mb-1 block text-text-muted">Server name</span>
              <input
                class="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 focus:border-accent focus:outline-none"
                [value]="current.ServerName ?? ''"
                (change)="setString('ServerName', $event)"
              />
            </label>
            <label class="mt-4 block text-sm">
              <span class="mb-1 block text-text-muted">Display language</span>
              <select
                class="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 focus:border-accent focus:outline-none"
                (change)="setString('UICulture', $event)"
              >
                @for (option of languages.value(); track option.Value) {
                  <option [value]="option.Value" [selected]="option.Value === current.UICulture">
                    {{ option.Name }}
                  </option>
                }
              </select>
            </label>
            <div class="mt-4 space-y-2">
              <label class="flex items-start gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-raised/60">
                <input
                  type="checkbox"
                  class="mt-1 size-4 accent-accent"
                  [checked]="current.QuickConnectAvailable === true"
                  (change)="setBool('QuickConnectAvailable', $event)"
                />
                <span class="min-w-0">
                  <span class="block text-sm">Quick Connect</span>
                  <span class="block text-xs text-text-faint">Sign in on TVs by entering a short code</span>
                </span>
              </label>
              <label class="flex items-start gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-raised/60">
                <input
                  type="checkbox"
                  class="mt-1 size-4 accent-accent"
                  [checked]="current.EnableFolderView === true"
                  (change)="setBool('EnableFolderView', $event)"
                />
                <span class="min-w-0">
                  <span class="block text-sm">Folder view</span>
                  <span class="block text-xs text-text-faint">Expose plain media folders as a library</span>
                </span>
              </label>
            </div>
          </section>

          <section class="rounded-xl border border-border bg-surface p-4">
            <h2 class="mb-3 text-lg font-semibold">Metadata</h2>
            <label class="block text-sm">
              <span class="mb-1 block text-text-muted">Preferred metadata language</span>
              <select
                class="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 focus:border-accent focus:outline-none"
                (change)="setString('PreferredMetadataLanguage', $event)"
              >
                @for (culture of metadataLanguages(); track culture.TwoLetterISOLanguageName) {
                  <option
                    [value]="culture.TwoLetterISOLanguageName"
                    [selected]="culture.TwoLetterISOLanguageName === current.PreferredMetadataLanguage"
                  >
                    {{ culture.DisplayName }}
                  </option>
                }
              </select>
            </label>
            <label class="mt-4 block text-sm">
              <span class="mb-1 block text-text-muted">Country</span>
              <select
                class="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 focus:border-accent focus:outline-none"
                (change)="setString('MetadataCountryCode', $event)"
              >
                @for (country of countries.value(); track country.TwoLetterISORegionName) {
                  <option
                    [value]="country.TwoLetterISORegionName"
                    [selected]="country.TwoLetterISORegionName === current.MetadataCountryCode"
                  >
                    {{ country.DisplayName }}
                  </option>
                }
              </select>
            </label>
          </section>

          <section class="rounded-xl border border-border bg-surface p-4">
            <h2 class="mb-3 text-lg font-semibold">Playback</h2>
            <div class="space-y-4">
              @for (field of resumeNumbers; track field.key) {
                <label class="block text-sm">
                  <span class="mb-1 block text-text-muted">{{ field.label }}</span>
                  <input
                    type="number"
                    [min]="field.min"
                    [max]="field.max"
                    class="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 focus:border-accent focus:outline-none"
                    [value]="numberValue(field.key)"
                    (change)="setNumber(field.key, field, $event)"
                  />
                  @if (field.hint) {
                    <span class="mt-1 block text-xs text-text-faint">{{ field.hint }}</span>
                  }
                </label>
              }
              <label class="block text-sm">
                <span class="mb-1 block text-text-muted">Remote stream bitrate limit (Mbps, 0 = unlimited)</span>
                <input
                  type="number"
                  min="0"
                  max="1000"
                  step="0.1"
                  class="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 focus:border-accent focus:outline-none"
                  [value]="bitrateMbps()"
                  (change)="setBitrate($event)"
                />
                <span class="mt-1 block text-xs text-text-faint">Applies to connections from outside the local network</span>
              </label>
            </div>
          </section>

          <section class="rounded-xl border border-border bg-surface p-4">
            <h2 class="mb-3 text-lg font-semibold">Display & retention</h2>
            <div class="space-y-2">
              @for (toggle of displayToggles; track toggle.key) {
                <label class="flex items-start gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-raised/60">
                  <input
                    type="checkbox"
                    class="mt-1 size-4 accent-accent"
                    [checked]="boolValue(toggle.key)"
                    (change)="setBool(toggle.key, $event)"
                  />
                  <span class="min-w-0">
                    <span class="block text-sm">{{ toggle.label }}</span>
                    @if (toggle.hint) {
                      <span class="block text-xs text-text-faint">{{ toggle.hint }}</span>
                    }
                  </span>
                </label>
              }
            </div>
            <div class="mt-4 space-y-4">
              @for (field of retentionNumbers; track field.key) {
                <label class="block text-sm">
                  <span class="mb-1 block text-text-muted">{{ field.label }}</span>
                  <input
                    type="number"
                    [min]="field.min"
                    [max]="field.max"
                    class="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 focus:border-accent focus:outline-none"
                    [value]="numberValue(field.key)"
                    (change)="setNumber(field.key, field, $event)"
                  />
                </label>
              }
            </div>
          </section>
        </div>
      } @else if (serverConfig.isLoading()) {
        <div class="mt-6 grid gap-6 lg:grid-cols-2">
          @for (card of skeletonCards; track card) {
            <div class="h-64 animate-pulse rounded-xl bg-surface"></div>
          }
        </div>
      } @else if (serverConfig.error()) {
        <p class="mt-6 text-sm text-danger">Couldn't load the server configuration.</p>
      }
    </main>
  `,
})
export class AdminSettingsPage {
  private readonly config = inject(ApiConfig);
  private readonly api = inject(SystemConfigApi);
  private readonly toast = inject(ToastService);

  protected readonly serverConfig = httpResource<ServerConfiguration>(() =>
    systemConfigRequest(this.config),
  );
  protected readonly languages = httpResource<LocalizationOption[]>(() =>
    localizationOptionsRequest(this.config),
  );
  private readonly cultures = httpResource<CultureDto[]>(() => culturesRequest(this.config));

  /** Only cultures addressable by the two-letter code the config stores. */
  protected readonly metadataLanguages = computed(() => {
    const byCode = new Map<string, CultureDto>();
    for (const culture of this.cultures.value() ?? []) {
      const code = culture.TwoLetterISOLanguageName;
      if (code && !byCode.has(code)) byCode.set(code, culture);
    }
    return [...byCode.values()];
  });
  protected readonly countries = httpResource<CountryInfo[]>(() => countriesRequest(this.config));

  /** Editable copy; resets whenever the config reloads. */
  protected readonly draft = linkedSignal<ServerConfiguration | undefined>(() =>
    this.serverConfig.value(),
  );

  protected readonly saving = signal(false);
  protected readonly displayToggles = DISPLAY_TOGGLES;
  protected readonly resumeNumbers = RESUME_NUMBERS;
  protected readonly retentionNumbers = RETENTION_NUMBERS;
  protected readonly skeletonCards = Array.from({ length: 4 }, (_, i) => i);

  protected readonly bitrateMbps = computed(() => {
    const bps = this.draft()?.RemoteClientBitrateLimit ?? 0;
    return bps / 1_000_000;
  });

  protected boolValue(key: string): boolean {
    return this.draft()?.[key] === true;
  }

  protected numberValue(key: string): number {
    return Number(this.draft()?.[key] ?? 0);
  }

  protected setString(key: string, event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value;
    this.draft.update((current) => current && { ...current, [key]: value });
  }

  protected setBool(key: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.draft.update((current) => current && { ...current, [key]: checked });
  }

  protected setNumber(key: string, bounds: { min: number; max: number }, event: Event): void {
    const raw = Number((event.target as HTMLInputElement).value);
    const value = Math.min(bounds.max, Math.max(bounds.min, Number.isFinite(raw) ? raw : bounds.min));
    this.draft.update((current) => current && { ...current, [key]: value });
  }

  protected setBitrate(event: Event): void {
    const mbps = Math.max(0, Number((event.target as HTMLInputElement).value) || 0);
    this.draft.update(
      (current) => current && { ...current, RemoteClientBitrateLimit: Math.round(mbps * 1_000_000) },
    );
  }

  protected async save(): Promise<void> {
    const configuration = this.draft();
    if (!configuration || this.saving()) return;
    this.saving.set(true);
    try {
      await this.api.update(configuration);
      this.toast.show('Settings saved', 'info');
      this.serverConfig.reload();
    } catch {
      this.toast.show('The server rejected the configuration change');
    } finally {
      this.saving.set(false);
    }
  }
}

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
  selector: 'jf-admin-settings-page',
  templateUrl: './admin-settings-page.html',
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
    const value = Math.min(
      bounds.max,
      Math.max(bounds.min, Number.isFinite(raw) ? raw : bounds.min),
    );
    this.draft.update((current) => current && { ...current, [key]: value });
  }

  protected setBitrate(event: Event): void {
    const mbps = Math.max(0, Number((event.target as HTMLInputElement).value) || 0);
    this.draft.update(
      (current) =>
        current && { ...current, RemoteClientBitrateLimit: Math.round(mbps * 1_000_000) },
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

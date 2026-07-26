import { Component, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { FormField, form, required, validate } from '@angular/forms/signals';
import { SessionStore } from '@entities/user';
import {
  ApiConfig,
  CultureDto,
  PROFILE_IMAGE_TYPES,
  SubtitlePlaybackMode,
  UserConfiguration,
  UserDto,
  UserProfileApi,
  culturesRequest,
  currentUserRequest,
  injectMutation,
  userImageUrl,
} from '@shared/api';
import { ToastService } from '@shared/ui/toast';

/** Keys of UserConfiguration whose value is a plain flag. */
type BooleanPreference = {
  [K in keyof UserConfiguration]-?: UserConfiguration[K] extends boolean | undefined ? K : never;
}[keyof UserConfiguration];

interface PreferenceToggle {
  key: BooleanPreference;
  label: string;
  hint?: string;
}

const PREFERENCE_GROUPS: { title: string; items: PreferenceToggle[] }[] = [
  {
    title: 'Playback',
    items: [
      {
        key: 'PlayDefaultAudioTrack',
        label: 'Always play the default audio track',
        hint: 'Ignores the audio language preference',
      },
      { key: 'EnableNextEpisodeAutoPlay', label: 'Autoplay the next episode' },
      {
        key: 'RememberAudioSelections',
        label: 'Remember audio track choices',
        hint: 'Reuses the track you picked for the rest of a series',
      },
      { key: 'RememberSubtitleSelections', label: 'Remember subtitle choices' },
    ],
  },
  {
    title: 'Library display',
    items: [
      {
        key: 'DisplayMissingEpisodes',
        label: 'Show missing episodes',
        hint: 'Episodes the server knows about but has no file for',
      },
      { key: 'HidePlayedInLatest', label: 'Hide watched items from Latest rails' },
      { key: 'DisplayCollectionsView', label: 'Show a Collections library' },
    ],
  },
];

const SUBTITLE_MODES: { value: SubtitlePlaybackMode; label: string }[] = [
  { value: 'Default', label: 'Default' },
  { value: 'Smart', label: 'Only when the audio is in another language' },
  { value: 'OnlyForced', label: 'Only forced subtitles' },
  { value: 'Always', label: 'Always show subtitles' },
  { value: 'None', label: 'No subtitles' },
];

/** Jellyfin's default body limit is generous, but a 10 MB avatar helps nobody. */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

@Component({
  selector: 'jf-profile-page',
  imports: [FormField],
  templateUrl: './profile-page.html',
})
export class ProfilePage {
  private readonly config = inject(ApiConfig);
  private readonly api = inject(UserProfileApi);
  private readonly session = inject(SessionStore);
  private readonly toast = inject(ToastService);
  // Every section edits a draft that resets when the account reloads, so a
  // failed save must NOT refetch — reload only on success, via injectMutation.
  private readonly run = injectMutation();

  protected readonly me = httpResource<UserDto>(() => currentUserRequest(this.config));
  private readonly cultures = httpResource<CultureDto[]>(() => culturesRequest(this.config));

  constructor() {
    // The header renders the name and avatar, so it follows every save here.
    effect(() => {
      const user = this.me.value();
      if (user) this.session.setUser(user);
    });
  }

  protected readonly avatarUrl = computed(() => {
    const user = this.me.value();
    return user ? userImageUrl(this.config, user) : null;
  });
  protected readonly initial = computed(() => this.me.value()?.Name.charAt(0).toUpperCase() ?? '');
  protected readonly imageAccept = PROFILE_IMAGE_TYPES.join(',');
  protected readonly uploading = signal(false);
  protected readonly skeletonCards = Array.from({ length: 4 }, (_, i) => i);

  // --- Account name -------------------------------------------------------

  private readonly nameModel = linkedSignal(() => ({ name: this.me.value()?.Name ?? '' }));
  protected readonly nameForm = form(this.nameModel, (account) => {
    required(account.name, { message: 'Your account needs a name' });
  });
  protected readonly savingName = signal(false);
  protected readonly nameChanged = computed(
    () => this.nameModel().name.trim() !== (this.me.value()?.Name ?? ''),
  );

  // --- Password -----------------------------------------------------------

  private readonly passwordModel = signal({ current: '', next: '', confirm: '' });
  protected readonly passwordForm = form(this.passwordModel, (password) => {
    required(password.current, {
      when: () => this.me.value()?.HasPassword === true,
      message: 'Enter your current password',
    });
    required(password.next, { message: 'Enter a new password' });
    validate(password.confirm, ({ value, valueOf }) =>
      value() === valueOf(password.next) ? null : { kind: 'mismatch', message: 'Passwords differ' },
    );
  });
  protected readonly savingPassword = signal(false);
  protected readonly hasPassword = computed(() => this.me.value()?.HasPassword === true);

  // --- Preferences --------------------------------------------------------

  /** Editable copy of the configuration; resets whenever the account reloads. */
  protected readonly prefs = linkedSignal<UserConfiguration | undefined>(
    () => this.me.value()?.Configuration,
  );
  protected readonly savingPrefs = signal(false);
  protected readonly preferenceGroups = PREFERENCE_GROUPS;
  protected readonly subtitleModes = SUBTITLE_MODES;

  /** Only cultures addressable by the three-letter code the configuration stores. */
  protected readonly languages = computed(() => {
    const byCode = new Map<string, CultureDto>();
    for (const culture of this.cultures.value() ?? []) {
      const code = culture.ThreeLetterISOLanguageName;
      if (code && !byCode.has(code)) byCode.set(code, culture);
    }
    return [...byCode.values()].sort((a, b) => a.DisplayName.localeCompare(b.DisplayName));
  });

  protected boolValue(key: BooleanPreference): boolean {
    return this.prefs()?.[key] === true;
  }

  protected setBool(key: BooleanPreference, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.prefs.update((prefs) => prefs && { ...prefs, [key]: checked });
  }

  protected setLanguage(
    key: 'AudioLanguagePreference' | 'SubtitleLanguagePreference',
    event: Event,
  ): void {
    const code = (event.target as HTMLSelectElement).value;
    this.prefs.update((prefs) => prefs && { ...prefs, [key]: code === '' ? null : code });
  }

  protected setSubtitleMode(event: Event): void {
    const mode = (event.target as HTMLSelectElement).value as SubtitlePlaybackMode;
    this.prefs.update((prefs) => prefs && { ...prefs, SubtitleMode: mode });
  }

  // --- Saves --------------------------------------------------------------

  protected async saveName(event: Event): Promise<void> {
    event.preventDefault();
    const user = this.me.value();
    const name = this.nameModel().name.trim();
    if (!user || !this.nameForm().valid() || this.savingName() || name === user.Name) return;
    this.savingName.set(true);
    const ok = await this.run(
      () => this.api.updateProfile({ ...user, Name: name }),
      `You are now “${name}”`,
      'The server rejected that name — it may already be taken',
    );
    if (ok) this.me.reload();
    this.savingName.set(false);
  }

  protected async savePassword(event: Event): Promise<void> {
    event.preventDefault();
    const user = this.me.value();
    if (!user || !this.passwordForm().valid() || this.savingPassword()) return;
    this.savingPassword.set(true);
    const { current, next } = this.passwordModel();
    const ok = await this.run(
      () => this.api.changePassword(user.Id, current, next),
      'Password changed',
      'Password not changed — check your current password',
    );
    if (ok) {
      this.passwordModel.set({ current: '', next: '', confirm: '' });
      this.me.reload();
    }
    this.savingPassword.set(false);
  }

  protected async savePreferences(): Promise<void> {
    const user = this.me.value();
    const prefs = this.prefs();
    if (!user || !prefs || this.savingPrefs()) return;
    this.savingPrefs.set(true);
    const ok = await this.run(
      () => this.api.updateConfiguration(user.Id, prefs),
      'Preferences saved',
      'The server rejected the preference change',
    );
    if (ok) this.me.reload();
    this.savingPrefs.set(false);
  }

  // --- Profile picture ----------------------------------------------------

  protected async onImagePicked(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Clear immediately so picking the same file twice still fires a change.
    input.value = '';
    const user = this.me.value();
    if (!file || !user || this.uploading()) return;
    if (!PROFILE_IMAGE_TYPES.includes(file.type)) {
      this.toast.show('Pick a JPEG, PNG, WebP or GIF image');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      this.toast.show('That image is larger than 10 MB');
      return;
    }
    this.uploading.set(true);
    const ok = await this.run(
      () => this.api.uploadImage(user.Id, file),
      'Profile picture updated',
      'The server rejected that image',
    );
    if (ok) this.me.reload();
    this.uploading.set(false);
  }

  protected async removeImage(): Promise<void> {
    const user = this.me.value();
    if (!user || this.uploading()) return;
    this.uploading.set(true);
    const ok = await this.run(
      () => this.api.deleteImage(user.Id),
      'Profile picture removed',
      "Couldn't remove the picture",
    );
    if (ok) this.me.reload();
    this.uploading.set(false);
  }
}

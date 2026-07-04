import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import {
  AdminUsersApi,
  ApiConfig,
  ParentalRating,
  UserDto,
  UserPolicy,
  VirtualFolderInfo,
  injectMutation,
  parentalRatingsRequest,
  userRequest,
  virtualFoldersRequest,
} from '@shared/api';

interface PolicyToggle {
  key: string;
  label: string;
  hint?: string;
}

const TOGGLE_GROUPS: { title: string; items: PolicyToggle[] }[] = [
  {
    title: 'Access',
    items: [
      {
        key: 'IsAdministrator',
        label: 'Administrator',
        hint: 'Full control of the server and this dashboard',
      },
      { key: 'IsDisabled', label: 'Disabled', hint: 'Cannot sign in' },
      { key: 'IsHidden', label: 'Hidden', hint: 'Not shown on the login screen' },
      {
        key: 'EnableRemoteAccess',
        label: 'Remote connections',
        hint: 'Connect from outside the local network',
      },
    ],
  },
  {
    title: 'Playback',
    items: [
      { key: 'EnableMediaPlayback', label: 'Media playback' },
      { key: 'EnableAudioPlaybackTranscoding', label: 'Audio transcoding' },
      { key: 'EnableVideoPlaybackTranscoding', label: 'Video transcoding' },
      {
        key: 'EnablePlaybackRemuxing',
        label: 'Remuxing',
        hint: 'Repackage streams without re-encoding',
      },
    ],
  },
  {
    title: 'Features',
    items: [
      { key: 'EnableContentDownloading', label: 'Downloads' },
      { key: 'EnableContentDeletion', label: 'Media deletion' },
      { key: 'EnableCollectionManagement', label: 'Manage collections' },
      { key: 'EnableSubtitleManagement', label: 'Manage subtitles' },
      { key: 'EnableSharedDeviceControl', label: 'Control shared devices' },
      { key: 'EnableRemoteControlOfOtherUsers', label: 'Remote-control other users' },
      { key: 'EnableLiveTvAccess', label: 'Live TV access' },
      { key: 'EnableLiveTvManagement', label: 'Live TV management' },
    ],
  },
];

@Component({
  selector: 'jf-admin-user-page',
  imports: [RouterLink],
  templateUrl: './admin-user-page.html',
})
export class AdminUserPage {
  /** Route param via withComponentInputBinding. */
  readonly id = input.required<string>();

  private readonly config = inject(ApiConfig);
  private readonly api = inject(AdminUsersApi);
  // Draft page: the linkedSignal draft resets when the user reloads, so a
  // failed save must NOT refetch — reload only on success, via injectMutation.
  private readonly run = injectMutation();

  protected readonly user = httpResource<UserDto>(() => userRequest(this.config, this.id()));
  protected readonly libraries = httpResource<VirtualFolderInfo[]>(() =>
    virtualFoldersRequest(this.config),
  );
  private readonly ratings = httpResource<ParentalRating[]>(() =>
    parentalRatingsRequest(this.config),
  );

  /** Editable copy of the policy; resets whenever the user reloads. */
  protected readonly draft = linkedSignal<UserPolicy | undefined>(() => this.user.value()?.Policy);

  protected readonly saving = signal(false);
  protected readonly toggleGroups = TOGGLE_GROUPS;
  protected readonly skeletonCards = Array.from({ length: 4 }, (_, i) => i);

  /** Ratings deduped by threshold value, ascending. */
  protected readonly ratingOptions = computed(() => {
    const byValue = new Map<number, ParentalRating>();
    for (const rating of this.ratings.value() ?? []) {
      if (rating.Value != null && !byValue.has(rating.Value)) byValue.set(rating.Value, rating);
    }
    return [...byValue.values()].sort((a, b) => (a.Value ?? 0) - (b.Value ?? 0));
  });

  protected readonly ratingValue = computed(() => {
    const value = this.draft()?.MaxParentalRating;
    return value == null ? '' : String(value);
  });

  /** Admin/disabled cannot be changed on your own account (mirrors the list page). */
  protected selfLocked(key: string): boolean {
    return (
      (key === 'IsAdministrator' || key === 'IsDisabled') && this.id() === this.config.userId()
    );
  }

  protected boolValue(key: string): boolean {
    return this.draft()?.[key] === true;
  }

  protected setBool(key: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.draft.update((policy) => policy && { ...policy, [key]: checked });
  }

  protected folderEnabled(folderId: string): boolean {
    return this.draft()?.EnabledFolders?.includes(folderId) ?? false;
  }

  protected setFolder(folderId: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.draft.update((policy) => {
      if (!policy) return policy;
      const current = policy.EnabledFolders ?? [];
      const next = checked ? [...current, folderId] : current.filter((id) => id !== folderId);
      return { ...policy, EnabledFolders: next };
    });
  }

  protected setRating(event: Event): void {
    const raw = (event.target as HTMLSelectElement).value;
    this.draft.update(
      (policy) => policy && { ...policy, MaxParentalRating: raw === '' ? null : Number(raw) },
    );
  }

  protected setMaxSessions(event: Event): void {
    const value = Math.max(0, Number((event.target as HTMLInputElement).value) || 0);
    this.draft.update((policy) => policy && { ...policy, MaxActiveSessions: value });
  }

  protected async save(): Promise<void> {
    const policy = this.draft();
    if (!policy || this.saving()) return;
    this.saving.set(true);
    const ok = await this.run(
      () => this.api.updatePolicy(this.id(), policy),
      'Policy saved',
      'The server rejected the policy change',
    );
    if (ok) this.user.reload();
    this.saving.set(false);
  }
}

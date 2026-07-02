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
  parentalRatingsRequest,
  userRequest,
  virtualFoldersRequest,
} from '@shared/api';
import { ToastService } from '@shared/ui/toast';

interface PolicyToggle {
  key: string;
  label: string;
  hint?: string;
}

const TOGGLE_GROUPS: { title: string; items: PolicyToggle[] }[] = [
  {
    title: 'Access',
    items: [
      { key: 'IsAdministrator', label: 'Administrator', hint: 'Full control of the server and this dashboard' },
      { key: 'IsDisabled', label: 'Disabled', hint: 'Cannot sign in' },
      { key: 'IsHidden', label: 'Hidden', hint: 'Not shown on the login screen' },
      { key: 'EnableRemoteAccess', label: 'Remote connections', hint: 'Connect from outside the local network' },
    ],
  },
  {
    title: 'Playback',
    items: [
      { key: 'EnableMediaPlayback', label: 'Media playback' },
      { key: 'EnableAudioPlaybackTranscoding', label: 'Audio transcoding' },
      { key: 'EnableVideoPlaybackTranscoding', label: 'Video transcoding' },
      { key: 'EnablePlaybackRemuxing', label: 'Remuxing', hint: 'Repackage streams without re-encoding' },
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
  selector: 'app-admin-user-page',
  imports: [RouterLink],
  template: `
    <main>
      <a routerLink="/admin/users" class="text-sm text-text-muted transition-colors hover:text-text">
        ← Users
      </a>

      @if (user.value(); as account) {
        <div class="mt-2 flex flex-wrap items-center justify-between gap-4">
          <h1 class="text-2xl font-bold">{{ account.Name }}</h1>
          <button
            type="button"
            [disabled]="saving()"
            class="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
            (click)="save()"
          >
            {{ saving() ? 'Saving…' : 'Save changes' }}
          </button>
        </div>

        <div class="mt-6 grid gap-6 lg:grid-cols-2">
          @for (group of toggleGroups; track group.title) {
            <section class="rounded-xl border border-border bg-surface p-4">
              <h2 class="mb-3 text-lg font-semibold">{{ group.title }}</h2>
              <div class="space-y-2">
                @for (toggle of group.items; track toggle.key) {
                  <label class="flex items-start gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-raised/60">
                    <input
                      type="checkbox"
                      class="mt-1 size-4 accent-accent"
                      [checked]="boolValue(toggle.key)"
                      [disabled]="selfLocked(toggle.key)"
                      (change)="setBool(toggle.key, $event)"
                    />
                    <span class="min-w-0">
                      <span class="block text-sm">{{ toggle.label }}</span>
                      @if (toggle.hint) {
                        <span class="block text-xs text-text-faint">{{ toggle.hint }}</span>
                      }
                      @if (selfLocked(toggle.key)) {
                        <span class="block text-xs text-text-faint">Locked for your own account</span>
                      }
                    </span>
                  </label>
                }
              </div>
            </section>
          }

          <section class="rounded-xl border border-border bg-surface p-4">
            <h2 class="mb-3 text-lg font-semibold">Library access</h2>
            <label class="flex items-start gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-raised/60">
              <input
                type="checkbox"
                class="mt-1 size-4 accent-accent"
                [checked]="boolValue('EnableAllFolders')"
                (change)="setBool('EnableAllFolders', $event)"
              />
              <span class="text-sm">All libraries</span>
            </label>
            @if (!boolValue('EnableAllFolders')) {
              <div class="mt-2 space-y-1 border-t border-border pt-2">
                @for (library of libraries.value(); track library.Name) {
                  @if (library.ItemId; as folderId) {
                    <label class="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-raised/60">
                      <input
                        type="checkbox"
                        class="size-4 accent-accent"
                        [checked]="folderEnabled(folderId)"
                        (change)="setFolder(folderId, $event)"
                      />
                      <span class="text-sm">{{ library.Name }}</span>
                    </label>
                  }
                }
              </div>
            }
          </section>

          <section class="rounded-xl border border-border bg-surface p-4">
            <h2 class="mb-3 text-lg font-semibold">Restrictions</h2>
            <label class="block text-sm">
              <span class="mb-1 block text-text-muted">Maximum parental rating</span>
              <select
                class="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 focus:border-accent focus:outline-none"
                [value]="ratingValue()"
                (change)="setRating($event)"
              >
                <option value="">No limit</option>
                @for (rating of ratingOptions(); track rating.Name) {
                  <option [value]="rating.Value">{{ rating.Name }}</option>
                }
              </select>
            </label>
            <label class="mt-4 block text-sm">
              <span class="mb-1 block text-text-muted">Maximum parallel streams (0 = unlimited)</span>
              <input
                type="number"
                min="0"
                max="100"
                class="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 focus:border-accent focus:outline-none"
                [value]="draft()?.MaxActiveSessions ?? 0"
                (change)="setMaxSessions($event)"
              />
            </label>
          </section>
        </div>
      } @else if (user.isLoading()) {
        <div class="mt-6 grid gap-6 lg:grid-cols-2">
          @for (card of skeletonCards; track card) {
            <div class="h-56 animate-pulse rounded-xl bg-surface"></div>
          }
        </div>
      } @else if (user.error()) {
        <p class="mt-6 text-sm text-danger">Couldn't load this user.</p>
      }
    </main>
  `,
})
export class AdminUserPage {
  /** Route param via withComponentInputBinding. */
  readonly id = input.required<string>();

  private readonly config = inject(ApiConfig);
  private readonly api = inject(AdminUsersApi);
  private readonly toast = inject(ToastService);

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
    try {
      await this.api.updatePolicy(this.id(), policy);
      this.toast.show('Policy saved', 'info');
      this.user.reload();
    } catch {
      this.toast.show('The server rejected the policy change');
    } finally {
      this.saving.set(false);
    }
  }
}

import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { FormField, form, required } from '@angular/forms/signals';
import { BrnDialog, BrnDialogImports } from '@spartan-ng/brain/dialog';
import { AdminUsersApi, ApiConfig, UserDto, usersRequest } from '@shared/api';
import { ConfirmService } from '@shared/ui/confirm-dialog';
import { PromptService } from '@shared/ui/prompt-dialog';
import { ToastService } from '@shared/ui/toast';

@Component({
  selector: 'app-admin-users-page',
  imports: [DatePipe, FormField, BrnDialogImports],
  template: `
    <main>
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold">Users</h1>
          <p class="mt-1 text-sm text-text-muted">Accounts on this server.</p>
        </div>

        <brn-dialog #createDialog="brnDialog">
          <button
            brnDialogTrigger
            class="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            New user
          </button>
          <brn-dialog-overlay class="bg-black/60" />
          <div
            *brnDialogContent
            class="w-[min(92vw,26rem)] rounded-xl border border-border bg-surface-raised p-6 shadow-2xl"
          >
            <h2 brnDialogTitle class="text-lg font-semibold">New user</h2>
            <form class="mt-4 space-y-4" (submit)="create($event, createDialog)">
              <label class="block text-sm">
                <span class="mb-1 block text-text-muted">Username</span>
                <input
                  [formField]="userForm.name"
                  autocomplete="off"
                  class="w-full rounded-lg border border-border bg-surface px-3 py-2 focus:border-accent focus:outline-none"
                />
                @if (userForm.name().touched() && !userForm.name().valid()) {
                  <span class="mt-1 block text-xs text-danger">Username is required.</span>
                }
              </label>
              <label class="block text-sm">
                <span class="mb-1 block text-text-muted">Password</span>
                <input
                  type="password"
                  [formField]="userForm.password"
                  autocomplete="new-password"
                  class="w-full rounded-lg border border-border bg-surface px-3 py-2 focus:border-accent focus:outline-none"
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
                  [disabled]="!userForm().valid() || creating()"
                  class="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
                >
                  {{ creating() ? 'Creating…' : 'Create' }}
                </button>
              </div>
            </form>
          </div>
        </brn-dialog>
      </div>

      @if (sortedUsers(); as list) {
        <div class="mt-6 overflow-x-auto rounded-xl border border-border">
          <table class="w-full text-left text-sm">
            <caption class="sr-only">Server user accounts</caption>
            <thead class="border-b border-border bg-surface text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th scope="col" class="px-4 py-3 font-semibold">User</th>
                <th scope="col" class="px-4 py-3 font-semibold">Role</th>
                <th scope="col" class="px-4 py-3 font-semibold">Status</th>
                <th scope="col" class="px-4 py-3 font-semibold">Last active</th>
                <th scope="col" class="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (user of list; track user.Id) {
                <tr class="border-b border-border/60 last:border-b-0">
                  <td class="whitespace-nowrap px-4 py-3 font-medium">
                    {{ user.Name }}
                    @if (isSelf(user)) {
                      <span class="ml-1 text-xs text-text-faint">(you)</span>
                    }
                  </td>
                  <td class="whitespace-nowrap px-4 py-3">
                    @if (user.Policy?.IsAdministrator) {
                      <span class="rounded-full border border-accent px-2 py-0.5 text-xs text-accent">Admin</span>
                    } @else {
                      <span class="text-text-muted">User</span>
                    }
                  </td>
                  <td class="whitespace-nowrap px-4 py-3">
                    @if (user.Policy?.IsDisabled) {
                      <span class="rounded-full border border-danger px-2 py-0.5 text-xs text-danger">Disabled</span>
                    } @else {
                      <span class="text-text-muted">Active</span>
                    }
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 text-text-muted">
                    {{ (user.LastActivityDate | date: 'MMM d, HH:mm') ?? 'Never' }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-3">
                    <div class="flex justify-end gap-1.5">
                      <button
                        type="button"
                        class="rounded-lg border border-border px-2 py-1 text-xs text-text-muted transition-colors enabled:hover:text-text disabled:opacity-40"
                        [disabled]="isSelf(user)"
                        [title]="isSelf(user) ? 'You cannot change your own admin role' : ''"
                        (click)="toggleAdmin(user)"
                      >
                        {{ user.Policy?.IsAdministrator ? 'Revoke admin' : 'Make admin' }}
                      </button>
                      <button
                        type="button"
                        class="rounded-lg border border-border px-2 py-1 text-xs text-text-muted transition-colors enabled:hover:text-text disabled:opacity-40"
                        [disabled]="isSelf(user)"
                        [title]="isSelf(user) ? 'You cannot disable yourself' : ''"
                        (click)="toggleDisabled(user)"
                      >
                        {{ user.Policy?.IsDisabled ? 'Enable' : 'Disable' }}
                      </button>
                      <button
                        type="button"
                        class="rounded-lg border border-border px-2 py-1 text-xs text-text-muted transition-colors hover:text-text"
                        (click)="setPassword(user)"
                      >
                        Set password
                      </button>
                      <button
                        type="button"
                        class="rounded-lg border border-border px-2 py-1 text-xs text-danger transition-colors enabled:hover:border-danger disabled:opacity-40"
                        [disabled]="isSelf(user)"
                        [title]="isSelf(user) ? 'You cannot delete yourself' : ''"
                        (click)="remove(user)"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (users.isLoading()) {
        <div class="mt-6 space-y-2">
          @for (row of skeletonRows; track row) {
            <div class="h-12 animate-pulse rounded-lg bg-surface"></div>
          }
        </div>
      } @else if (users.error()) {
        <p class="mt-6 text-sm text-danger">Couldn't load users.</p>
      }
    </main>
  `,
})
export class AdminUsersPage {
  private readonly config = inject(ApiConfig);
  private readonly api = inject(AdminUsersApi);
  private readonly confirm = inject(ConfirmService);
  private readonly prompt = inject(PromptService);
  private readonly toast = inject(ToastService);

  protected readonly users = httpResource<UserDto[]>(() => usersRequest(this.config));
  protected readonly sortedUsers = computed(() =>
    this.users.value()?.slice().sort((a, b) => a.Name.localeCompare(b.Name)),
  );

  protected readonly creating = signal(false);
  private readonly newUser = signal({ name: '', password: '' });
  protected readonly userForm = form(this.newUser, (user) => {
    required(user.name);
  });

  protected readonly skeletonRows = Array.from({ length: 5 }, (_, i) => i);

  protected isSelf(user: UserDto): boolean {
    return user.Id === this.config.userId();
  }

  protected async create(event: Event, dialog: BrnDialog): Promise<void> {
    event.preventDefault();
    if (!this.userForm().valid() || this.creating()) return;
    this.creating.set(true);
    const { name, password } = this.newUser();
    try {
      await this.api.createUser(name.trim(), password);
      this.toast.show(`Created user “${name.trim()}”`, 'info');
      dialog.close();
      this.newUser.set({ name: '', password: '' });
      this.users.reload();
    } catch {
      this.toast.show(`Couldn't create “${name.trim()}” — the server rejected it`);
    } finally {
      this.creating.set(false);
    }
  }

  protected async toggleAdmin(user: UserDto): Promise<void> {
    const makeAdmin = !user.Policy?.IsAdministrator;
    const confirmed = await this.confirm.ask({
      title: makeAdmin
        ? `Make ${user.Name} an administrator?`
        : `Revoke admin from ${user.Name}?`,
      message: makeAdmin
        ? 'Administrators have full control of the server, including this dashboard.'
        : 'They will immediately lose access to the dashboard.',
      confirmLabel: makeAdmin ? 'Make admin' : 'Revoke',
      danger: !makeAdmin,
    });
    if (!confirmed) return;
    await this.mutate(
      () => this.api.updatePolicy(user.Id, { ...user.Policy, IsAdministrator: makeAdmin }),
      `${user.Name} is ${makeAdmin ? 'now' : 'no longer'} an administrator`,
    );
  }

  protected async toggleDisabled(user: UserDto): Promise<void> {
    const disable = !user.Policy?.IsDisabled;
    if (disable) {
      const confirmed = await this.confirm.ask({
        title: `Disable ${user.Name}?`,
        message: 'They will be signed out and unable to sign in until re-enabled.',
        confirmLabel: 'Disable',
        danger: true,
      });
      if (!confirmed) return;
    }
    await this.mutate(
      () => this.api.updatePolicy(user.Id, { ...user.Policy, IsDisabled: disable }),
      `${user.Name} is ${disable ? 'disabled' : 'enabled'}`,
    );
  }

  protected async setPassword(user: UserDto): Promise<void> {
    const password = await this.prompt.ask({
      title: `Set password for ${user.Name}`,
      message: 'Their current password stops working immediately.',
      label: 'New password',
      inputType: 'password',
      confirmLabel: 'Set password',
    });
    if (password === null) return;
    await this.mutate(
      () => this.api.setPassword(user.Id, password),
      `Password for ${user.Name} was changed`,
    );
  }

  protected async remove(user: UserDto): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: `Delete ${user.Name}?`,
      message: 'This permanently removes the account and its watch history.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!confirmed) return;
    await this.mutate(() => this.api.deleteUser(user.Id), `Deleted ${user.Name}`);
  }

  private async mutate(action: () => Promise<void>, successMessage: string): Promise<void> {
    try {
      await action();
      this.toast.show(successMessage, 'info');
    } catch {
      this.toast.show('The server rejected the change');
    }
    this.users.reload();
  }
}

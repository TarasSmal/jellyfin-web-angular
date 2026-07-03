import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { FormField, form, required } from '@angular/forms/signals';
import { BrnDialog, BrnDialogImports } from '@spartan-ng/brain/dialog';
import { AdminUsersApi, ApiConfig, UserDto, usersRequest } from '@shared/api';
import { ConfirmService } from '@shared/ui/confirm-dialog';
import { PromptService } from '@shared/ui/prompt-dialog';
import { ToastService } from '@shared/ui/toast';

@Component({
  selector: 'jf-admin-users-page',
  imports: [DatePipe, RouterLink, FormField, BrnDialogImports],
  templateUrl: './admin-users-page.html',
})
export class AdminUsersPage {
  private readonly config = inject(ApiConfig);
  private readonly api = inject(AdminUsersApi);
  private readonly confirm = inject(ConfirmService);
  private readonly prompt = inject(PromptService);
  private readonly toast = inject(ToastService);

  protected readonly users = httpResource<UserDto[]>(() => usersRequest(this.config));
  protected readonly sortedUsers = computed(() =>
    this.users
      .value()
      ?.slice()
      .sort((a, b) => a.Name.localeCompare(b.Name)),
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
      title: makeAdmin ? `Make ${user.Name} an administrator?` : `Revoke admin from ${user.Name}?`,
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

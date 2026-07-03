import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ApiConfig, ApiKeysApi, AuthenticationInfoResult, apiKeysRequest } from '@shared/api';
import { ConfirmService } from '@shared/ui/confirm-dialog';
import { PromptService } from '@shared/ui/prompt-dialog';
import { ToastService } from '@shared/ui/toast';

@Component({
  selector: 'jf-admin-keys-page',
  imports: [DatePipe],
  templateUrl: './admin-keys-page.html',
})
export class AdminKeysPage {
  private readonly config = inject(ApiConfig);
  private readonly api = inject(ApiKeysApi);
  private readonly confirm = inject(ConfirmService);
  private readonly prompt = inject(PromptService);
  private readonly toast = inject(ToastService);

  protected readonly keys = httpResource<AuthenticationInfoResult>(() =>
    apiKeysRequest(this.config),
  );
  protected readonly items = computed(() => this.keys.value()?.Items);

  protected async create(): Promise<void> {
    const app = await this.prompt.ask({
      title: 'New API key',
      message: 'Name the app or script this key is for.',
      label: 'App name',
      confirmLabel: 'Create key',
    });
    if (app === null) return;
    try {
      await this.api.create(app.trim());
      this.toast.show(`Created a key for “${app.trim()}”`, 'info');
    } catch {
      this.toast.show("Couldn't create the key");
    }
    this.keys.reload();
  }

  protected async revoke(token: string, appName?: string): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: `Revoke the “${appName ?? 'unknown'}” key?`,
      message: 'Anything using this key loses access immediately.',
      confirmLabel: 'Revoke',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await this.api.revoke(token);
      this.toast.show('Key revoked', 'info');
    } catch {
      this.toast.show("Couldn't revoke the key");
    }
    this.keys.reload();
  }

  protected async copy(token: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(token);
      this.toast.show('Token copied', 'info');
    } catch {
      this.toast.show("Couldn't access the clipboard");
    }
  }
}

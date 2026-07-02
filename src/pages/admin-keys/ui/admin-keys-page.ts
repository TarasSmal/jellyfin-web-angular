import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ApiConfig, ApiKeysApi, AuthenticationInfoResult, apiKeysRequest } from '@shared/api';
import { ConfirmService } from '@shared/ui/confirm-dialog';
import { PromptService } from '@shared/ui/prompt-dialog';
import { ToastService } from '@shared/ui/toast';

@Component({
  selector: 'app-admin-keys-page',
  imports: [DatePipe],
  template: `
    <main>
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold">API Keys</h1>
          <p class="mt-1 text-sm text-text-muted">
            Tokens for other apps and scripts to talk to the server.
          </p>
        </div>
        <button
          type="button"
          class="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          (click)="create()"
        >
          New key
        </button>
      </div>

      @if (items(); as list) {
        <div class="mt-6 overflow-x-auto rounded-xl border border-border">
          <table class="w-full text-left text-sm">
            <caption class="sr-only">API keys</caption>
            <thead class="border-b border-border bg-surface text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th scope="col" class="px-4 py-3 font-semibold">App</th>
                <th scope="col" class="px-4 py-3 font-semibold">Token</th>
                <th scope="col" class="px-4 py-3 font-semibold">Created</th>
                <th scope="col" class="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (key of list; track key.AccessToken) {
                <tr class="border-b border-border/60 last:border-b-0">
                  <td class="whitespace-nowrap px-4 py-3 font-medium">{{ key.AppName }}</td>
                  <td class="px-4 py-3">
                    <button
                      type="button"
                      class="rounded bg-bg/60 px-2 py-0.5 font-mono text-xs text-text-muted transition-colors hover:text-text"
                      title="Copy to clipboard"
                      (click)="copy(key.AccessToken)"
                    >
                      {{ key.AccessToken }}
                    </button>
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 text-text-muted">
                    {{ key.DateCreated | date: 'MMM d, y' }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 text-right">
                    <button
                      type="button"
                      class="rounded-lg border border-border px-2 py-1 text-xs text-danger transition-colors hover:border-danger"
                      (click)="revoke(key.AccessToken, key.AppName)"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4" class="px-4 py-8 text-center text-text-muted">No API keys yet.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (keys.isLoading()) {
        <div class="mt-6 h-24 animate-pulse rounded-xl bg-surface"></div>
      } @else if (keys.error()) {
        <p class="mt-6 text-sm text-danger">Couldn't load API keys.</p>
      }
    </main>
  `,
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

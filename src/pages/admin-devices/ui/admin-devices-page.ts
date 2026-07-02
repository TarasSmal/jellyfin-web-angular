import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ApiConfig, DeviceInfoDto, DevicesApi, DevicesResult, devicesRequest } from '@shared/api';
import { getDeviceId } from '@shared/lib/device-id';
import { ConfirmService } from '@shared/ui/confirm-dialog';
import { PromptService } from '@shared/ui/prompt-dialog';
import { ToastService } from '@shared/ui/toast';

@Component({
  selector: 'app-admin-devices-page',
  imports: [DatePipe],
  template: `
    <main>
      <h1 class="text-2xl font-bold">Devices</h1>
      <p class="mt-1 text-sm text-text-muted">Everything that has signed in to this server.</p>

      @if (sortedDevices(); as list) {
        <div class="mt-6 overflow-x-auto rounded-xl border border-border">
          <table class="w-full text-left text-sm">
            <caption class="sr-only">Registered devices</caption>
            <thead class="border-b border-border bg-surface text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th scope="col" class="px-4 py-3 font-semibold">Device</th>
                <th scope="col" class="px-4 py-3 font-semibold">App</th>
                <th scope="col" class="px-4 py-3 font-semibold">Last user</th>
                <th scope="col" class="px-4 py-3 font-semibold">Last active</th>
                <th scope="col" class="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (device of list; track device.Id) {
                <tr class="border-b border-border/60 last:border-b-0">
                  <td class="whitespace-nowrap px-4 py-3 font-medium">
                    {{ device.CustomName || device.Name }}
                    @if (isThisDevice(device)) {
                      <span class="ml-1 text-xs text-text-faint">(this browser)</span>
                    }
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 text-text-muted">
                    {{ device.AppName }} {{ device.AppVersion }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 text-text-muted">{{ device.LastUserName }}</td>
                  <td class="whitespace-nowrap px-4 py-3 text-text-muted">
                    {{ (device.DateLastActivity | date: 'MMM d, HH:mm') ?? '—' }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-3">
                    <div class="flex justify-end gap-1.5">
                      <button
                        type="button"
                        class="rounded-lg border border-border px-2 py-1 text-xs text-text-muted transition-colors hover:text-text"
                        (click)="rename(device)"
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        class="rounded-lg border border-border px-2 py-1 text-xs text-danger transition-colors enabled:hover:border-danger disabled:opacity-40"
                        [disabled]="isThisDevice(device)"
                        [title]="isThisDevice(device) ? 'You cannot remove the device you are using' : ''"
                        (click)="remove(device)"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5" class="px-4 py-8 text-center text-text-muted">No devices yet.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (devices.isLoading()) {
        <div class="mt-6 h-24 animate-pulse rounded-xl bg-surface"></div>
      } @else if (devices.error()) {
        <p class="mt-6 text-sm text-danger">Couldn't load devices.</p>
      }
    </main>
  `,
})
export class AdminDevicesPage {
  private readonly config = inject(ApiConfig);
  private readonly api = inject(DevicesApi);
  private readonly confirm = inject(ConfirmService);
  private readonly prompt = inject(PromptService);
  private readonly toast = inject(ToastService);

  protected readonly devices = httpResource<DevicesResult>(() => devicesRequest(this.config));
  protected readonly sortedDevices = computed(() =>
    this.devices.value()?.Items.slice().sort((a, b) =>
      (b.DateLastActivity ?? '').localeCompare(a.DateLastActivity ?? ''),
    ),
  );

  protected isThisDevice(device: DeviceInfoDto): boolean {
    return device.Id === getDeviceId();
  }

  protected async rename(device: DeviceInfoDto): Promise<void> {
    const name = await this.prompt.ask({
      title: `Rename “${device.CustomName || device.Name}”`,
      message: 'The custom name shows everywhere instead of the reported device name.',
      label: 'Device name',
      confirmLabel: 'Rename',
    });
    if (name === null) return;
    try {
      await this.api.rename(device.Id, name.trim());
      this.toast.show('Device renamed', 'info');
    } catch {
      this.toast.show("Couldn't rename the device");
    }
    this.devices.reload();
  }

  protected async remove(device: DeviceInfoDto): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: `Remove “${device.CustomName || device.Name}”?`,
      message: 'Its sessions are revoked; the device must sign in again.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await this.api.remove(device.Id);
      this.toast.show('Device removed', 'info');
    } catch {
      this.toast.show("Couldn't remove the device");
    }
    this.devices.reload();
  }
}

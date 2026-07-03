import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ApiConfig, DeviceInfoDto, DevicesApi, DevicesResult, devicesRequest } from '@shared/api';
import { getDeviceId } from '@shared/lib/device-id';
import { ConfirmService } from '@shared/ui/confirm-dialog';
import { PromptService } from '@shared/ui/prompt-dialog';
import { ToastService } from '@shared/ui/toast';

@Component({
  selector: 'jf-admin-devices-page',
  imports: [DatePipe],
  templateUrl: './admin-devices-page.html',
})
export class AdminDevicesPage {
  private readonly config = inject(ApiConfig);
  private readonly api = inject(DevicesApi);
  private readonly confirm = inject(ConfirmService);
  private readonly prompt = inject(PromptService);
  private readonly toast = inject(ToastService);

  protected readonly devices = httpResource<DevicesResult>(() => devicesRequest(this.config));
  protected readonly sortedDevices = computed(() =>
    this.devices
      .value()
      ?.Items.slice()
      .sort((a, b) => (b.DateLastActivity ?? '').localeCompare(a.DateLastActivity ?? '')),
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

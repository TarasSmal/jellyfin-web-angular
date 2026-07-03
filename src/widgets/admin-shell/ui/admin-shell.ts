import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/** Layout for the admin dashboard: left section nav + content outlet. */
@Component({
  selector: 'jf-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-shell.html',
})
export class AdminShell {
  protected readonly sections = [
    { label: 'Overview', path: '/admin' },
    { label: 'Settings', path: '/admin/settings' },
    { label: 'Activity', path: '/admin/activity' },
    { label: 'Users', path: '/admin/users' },
    { label: 'Libraries', path: '/admin/libraries' },
    { label: 'Tasks', path: '/admin/tasks' },
    { label: 'Plugins', path: '/admin/plugins' },
    { label: 'Devices', path: '/admin/devices' },
    { label: 'API Keys', path: '/admin/keys' },
    { label: 'Logs', path: '/admin/logs' },
  ];
}

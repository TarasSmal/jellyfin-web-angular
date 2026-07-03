import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@features/auth';

@Component({
  selector: 'jf-connect-page',
  imports: [FormsModule],
  templateUrl: './connect-page.html',
})
export class ConnectPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly serverUrl = signal('');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  async submit(): Promise<void> {
    const url = this.serverUrl().trim();
    if (!url || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.connect(url);
      await this.router.navigate(['/login']);
    } catch {
      this.error.set('Could not reach a Jellyfin server at that address.');
    } finally {
      this.busy.set(false);
    }
  }
}

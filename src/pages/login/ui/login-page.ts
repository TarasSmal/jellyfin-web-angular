import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@features/auth';
import { ApiConfig } from '@shared/api';

@Component({
  selector: 'jf-login-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './login-page.html',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly config = inject(ApiConfig);

  readonly username = signal('');
  readonly password = signal('');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  async submit(): Promise<void> {
    if (this.busy() || !this.username().trim()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.login(this.username().trim(), this.password());
      await this.router.navigate(['/']);
    } catch {
      this.error.set('Sign-in failed. Check your username and password.');
    } finally {
      this.busy.set(false);
    }
  }
}

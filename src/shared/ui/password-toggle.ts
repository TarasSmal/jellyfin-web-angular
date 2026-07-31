import {
  Component,
  Directive,
  OnInit,
  ViewContainerRef,
  booleanAttribute,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

/** Eye button overlaid on a password input; dumb — `PasswordToggle` owns the state. */
@Component({
  selector: 'jf-password-toggle-button',
  templateUrl: './password-toggle.html',
  host: { class: 'absolute inset-y-0 right-0 flex items-center pr-1.5' },
})
export class PasswordToggleButton {
  readonly visible = input(false);
  readonly toggled = output<void>();
}

/**
 * Adds a show/hide eye button to a password field and owns the input's `type`.
 * The input must sit in a `relative` wrapper that hugs it:
 *
 * ```html
 * <div class="relative">
 *   <input jfPasswordToggle autocomplete="current-password" class="w-full …" />
 * </div>
 * ```
 */
@Directive({
  selector: 'input[jfPasswordToggle]',
  host: {
    '[type]': "enabled() ? (visible() ? 'text' : 'password') : 'text'",
    '[style.padding-inline-end.rem]': 'enabled() ? 2.75 : null',
  },
})
export class PasswordToggle implements OnInit {
  /** Set false to leave the field a plain text input — no masking, no button. */
  readonly enabled = input(true, { alias: 'jfPasswordToggle', transform: booleanAttribute });

  private readonly container = inject(ViewContainerRef);
  protected readonly visible = signal(false);

  ngOnInit(): void {
    if (!this.enabled()) return;

    const button = this.container.createComponent(PasswordToggleButton);
    button.instance.toggled.subscribe(() => {
      this.visible.update((shown) => !shown);
      button.setInput('visible', this.visible());
    });
  }
}

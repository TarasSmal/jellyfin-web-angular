import { describe, expect, it, beforeEach } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PasswordToggle } from './password-toggle';

@Component({
  selector: 'jf-password-toggle-host',
  imports: [PasswordToggle],
  template: `
    <div class="relative"><input [jfPasswordToggle]="enabled" /></div>
  `,
})
class TestHost {
  enabled = true;
}

describe('PasswordToggle', () => {
  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [TestHost] }).compileComponents();
  });

  function create(enabled = true) {
    const fixture = TestBed.createComponent(TestHost);
    fixture.componentInstance.enabled = enabled;
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    return {
      fixture,
      input: el.querySelector('input')!,
      button: el.querySelector('button'),
    };
  }

  it('masks the input and offers a show button', () => {
    const { input, button } = create();
    expect(input.type).toBe('password');
    expect(button?.getAttribute('aria-label')).toBe('Show password');
    expect(input.style.paddingInlineEnd).toBe('2.75rem');
  });

  it('reveals the value on click and masks it again', () => {
    const { fixture, input, button } = create();

    button!.click();
    fixture.detectChanges();
    expect(input.type).toBe('text');
    expect(button!.getAttribute('aria-label')).toBe('Hide password');
    expect(button!.getAttribute('aria-pressed')).toBe('true');

    button!.click();
    fixture.detectChanges();
    expect(input.type).toBe('password');
    expect(button!.getAttribute('aria-pressed')).toBe('false');
  });

  it('stays a plain text field when disabled', () => {
    const { input, button } = create(false);
    expect(input.type).toBe('text');
    expect(button).toBeNull();
    expect(input.style.paddingInlineEnd).toBe('');
  });
});

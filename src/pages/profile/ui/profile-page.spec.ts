import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiConfig, NOTIFIER, UserDto } from '@shared/api';
import { SessionStore } from '@entities/user';
import { ProfilePage } from './profile-page';

const account: UserDto = {
  Id: 'user-1',
  Name: 'qnasyst',
  HasPassword: true,
  PrimaryImageTag: 'avatar-tag',
  Configuration: {
    AudioLanguagePreference: 'ukr',
    PlayDefaultAudioTrack: true,
    SubtitleMode: 'Default',
    DisplayMissingEpisodes: false,
    EnableNextEpisodeAutoPlay: true,
  },
};

describe('ProfilePage', () => {
  let http: HttpTestingController;
  let notifier: { show: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    localStorage.clear();
    notifier = { show: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [ProfilePage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: NOTIFIER, useValue: notifier },
      ],
    }).compileComponents();
    const config = TestBed.inject(ApiConfig);
    config.setServer('http://jf.test');
    config.setSession('token', 'user-1');
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function createPage(user: UserDto = account) {
    const fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();
    http.expectOne('http://jf.test/Users/Me').flush(user);
    http.expectOne('http://jf.test/Localization/Cultures').flush([
      {
        DisplayName: 'Ukrainian',
        TwoLetterISOLanguageName: 'uk',
        ThreeLetterISOLanguageName: 'ukr',
      },
      { DisplayName: 'English', TwoLetterISOLanguageName: 'en', ThreeLetterISOLanguageName: 'eng' },
    ]);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  /** Let the mutation promise settle, then run the tick that starts the reload. */
  async function settle(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
    TestBed.tick();
  }

  function type(el: HTMLElement, selector: string, value: string): void {
    const input = el.querySelector<HTMLInputElement>(selector);
    if (!input) throw new Error(`no input for ${selector}`);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
  }

  function button(el: HTMLElement, label: string): HTMLButtonElement {
    const match = [...el.querySelectorAll('button')].find((b) => b.textContent?.includes(label));
    if (!match) throw new Error(`no button labelled ${label}`);
    return match;
  }

  it('renders the account and publishes it to the session store', async () => {
    const el: HTMLElement = (await createPage()).nativeElement;
    expect(el.querySelector<HTMLInputElement>('input[type=text]')?.value).toBe('qnasyst');
    expect(el.querySelector<HTMLImageElement>('img')?.src).toBe(
      'http://jf.test/UserImage?userId=user-1&tag=avatar-tag',
    );
    expect(TestBed.inject(SessionStore).user()?.Name).toBe('qnasyst');
  });

  it('renames the account with the complete DTO and re-reads it on success', async () => {
    const fixture = await createPage();
    const el: HTMLElement = fixture.nativeElement;

    type(el, 'input[type=text]', 'taras');
    fixture.detectChanges();
    button(el, 'Save name').click();

    const save = http.expectOne((r) => r.method === 'POST' && r.url === 'http://jf.test/Users');
    expect(save.request.params.get('userId')).toBe('user-1');
    expect(save.request.body).toEqual({ ...account, Name: 'taras' });
    save.flush(null);
    await settle();

    http.expectOne('http://jf.test/Users/Me').flush({ ...account, Name: 'taras' });
    TestBed.tick();
    expect(notifier.show).toHaveBeenCalledWith('You are now “taras”', 'info');
  });

  it('keeps the save disabled until the name actually changes', async () => {
    const fixture = await createPage();
    const el: HTMLElement = fixture.nativeElement;
    expect(button(el, 'Save name').disabled).toBe(true);

    type(el, 'input[type=text]', '');
    fixture.detectChanges();
    expect(button(el, 'Save name').disabled).toBe(true);
  });

  it('refuses a password change until both new entries match', async () => {
    const fixture = await createPage();
    const el: HTMLElement = fixture.nativeElement;

    type(el, 'input[autocomplete=current-password]', 'old-pw');
    type(el, 'input[autocomplete=new-password]', 'new-pw');
    el.querySelectorAll('input[autocomplete=new-password]')[1].dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(button(el, 'Change password').disabled).toBe(true);
    expect(el.textContent).toContain('Passwords differ');

    const [, confirm] = el.querySelectorAll<HTMLInputElement>('input[autocomplete=new-password]');
    confirm.value = 'new-pw';
    confirm.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(button(el, 'Change password').disabled).toBe(false);
  });

  it('sends the current and new password, then clears the form', async () => {
    const fixture = await createPage();
    const el: HTMLElement = fixture.nativeElement;

    type(el, 'input[autocomplete=current-password]', 'old-pw');
    const [next, confirm] = el.querySelectorAll<HTMLInputElement>(
      'input[autocomplete=new-password]',
    );
    for (const input of [next, confirm]) {
      input.value = 'new-pw';
      input.dispatchEvent(new Event('input'));
    }
    fixture.detectChanges();
    button(el, 'Change password').click();

    const save = http.expectOne(
      (r) => r.method === 'POST' && r.url === 'http://jf.test/Users/Password',
    );
    expect(save.request.params.get('userId')).toBe('user-1');
    expect(save.request.body).toEqual({ CurrentPw: 'old-pw', NewPw: 'new-pw' });
    save.flush(null);
    await settle();

    http.expectOne('http://jf.test/Users/Me').flush(account);
    TestBed.tick();
    fixture.detectChanges();
    expect(next.value).toBe('');
  });

  it('asks for no current password when the account has none', async () => {
    const fixture = await createPage({ ...account, HasPassword: false });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('input[autocomplete=current-password]')).toBeNull();

    const [next, confirm] = el.querySelectorAll<HTMLInputElement>(
      'input[autocomplete=new-password]',
    );
    for (const input of [next, confirm]) {
      input.value = 'first-pw';
      input.dispatchEvent(new Event('input'));
    }
    fixture.detectChanges();
    expect(button(el, 'Change password').disabled).toBe(false);
  });

  it('saves the whole configuration, not just the edited flag', async () => {
    const fixture = await createPage();
    const el: HTMLElement = fixture.nativeElement;

    const missingEpisodes = [...el.querySelectorAll<HTMLInputElement>('input[type=checkbox]')].find(
      (box) => box.closest('label')?.textContent?.includes('Show missing episodes'),
    );
    missingEpisodes?.click();
    fixture.detectChanges();
    button(el, 'Save preferences').click();

    const save = http.expectOne(
      (r) => r.method === 'POST' && r.url === 'http://jf.test/Users/Configuration',
    );
    expect(save.request.params.get('userId')).toBe('user-1');
    expect(save.request.body).toEqual({ ...account.Configuration, DisplayMissingEpisodes: true });
    save.flush(null);
    await settle();

    http.expectOne('http://jf.test/Users/Me').flush(account);
    TestBed.tick();
  });

  it('keeps the draft when the server rejects a preference save', async () => {
    const fixture = await createPage();
    const el: HTMLElement = fixture.nativeElement;

    const autoplay = [...el.querySelectorAll<HTMLInputElement>('input[type=checkbox]')].find(
      (box) => box.closest('label')?.textContent?.includes('Autoplay the next episode'),
    );
    autoplay?.click();
    fixture.detectChanges();
    button(el, 'Save preferences').click();

    http
      .expectOne((r) => r.url === 'http://jf.test/Users/Configuration')
      .flush('nope', { status: 400, statusText: 'Bad Request' });
    await Promise.resolve();
    TestBed.tick();
    fixture.detectChanges();

    // No refetch on failure, so the unsaved edit survives for a retry.
    expect(autoplay?.checked).toBe(false);
    expect(notifier.show).toHaveBeenCalledWith('The server rejected the preference change');
  });
});

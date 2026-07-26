import {
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ApiConfig, BaseItemDto } from '@shared/api';
import { cardSubtitle, itemThumbUrl } from '@entities/item';

/**
 * Presentational Up Next card in two modes. Countdown advertises the queued
 * episode while the policy ticks; confirm asks "Are you still watching?" and
 * waits. Dialog semantics with focus on the safe action (Cancel / Keep
 * watching), so a timer can never fire against a screen-reader user's intent;
 * the ticking number is hidden from assistive tech and the card is announced
 * exactly once.
 */
@Component({
  selector: 'jf-up-next-card',
  templateUrl: './up-next-card.html',
})
export class UpNextCard {
  private readonly config = inject(ApiConfig);

  readonly episode = input.required<BaseItemDto>();
  readonly mode = input.required<'countdown' | 'confirm'>();
  readonly secondsLeft = input(0);
  readonly playNow = output<void>();
  readonly cancelled = output<void>();

  private readonly focusTarget = viewChild.required<ElementRef<HTMLButtonElement>>('focusTarget');

  protected readonly thumbUrl = computed(() => itemThumbUrl(this.config, this.episode()));
  protected readonly line = computed(
    () => cardSubtitle(this.episode()) ?? this.episode().Name,
  );
  protected readonly announcement = signal('');

  constructor() {
    afterNextRender(() => {
      this.focusTarget().nativeElement.focus();
      // Set once after render so the live region announces it; the countdown
      // never touches this text.
      this.announcement.set(
        this.mode() === 'confirm'
          ? `Are you still watching? Up next: ${this.line()}.`
          : `Up next: ${this.line()}. Playing in ${this.secondsLeft()} seconds.`,
      );
    });
  }
}

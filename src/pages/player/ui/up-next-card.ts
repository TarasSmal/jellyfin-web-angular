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
 * Presentational Up Next card: advertises the queued episode while the policy
 * counts down. Dialog semantics with focus on Cancel, so the timer can never
 * fire against a screen-reader user's intent; the ticking number is hidden
 * from assistive tech and the card is announced exactly once.
 */
@Component({
  selector: 'jf-up-next-card',
  templateUrl: './up-next-card.html',
})
export class UpNextCard {
  private readonly config = inject(ApiConfig);

  readonly episode = input.required<BaseItemDto>();
  readonly secondsLeft = input.required<number>();
  readonly playNow = output<void>();
  readonly cancelled = output<void>();

  private readonly cancelButton =
    viewChild.required<ElementRef<HTMLButtonElement>>('cancelButton');

  protected readonly thumbUrl = computed(() => itemThumbUrl(this.config, this.episode()));
  protected readonly line = computed(
    () => cardSubtitle(this.episode()) ?? this.episode().Name,
  );
  protected readonly announcement = signal('');

  constructor() {
    afterNextRender(() => {
      this.cancelButton().nativeElement.focus();
      // Set once after render so the live region announces it; the countdown
      // never touches this text.
      this.announcement.set(
        `Up next: ${this.line()}. Playing in ${this.secondsLeft()} seconds.`,
      );
    });
  }
}

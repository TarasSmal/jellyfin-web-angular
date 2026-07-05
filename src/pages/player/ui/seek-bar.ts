import { Component, ElementRef, computed, inject, input, output } from '@angular/core';
import { Chapter } from '@features/play-session';
import { createScrubInteraction } from '../model/scrub-interaction';

/**
 * Custom seek bar: a thin DOM shell over the scrub-interaction model. Dragging
 * previews the target position with a timestamp tooltip and seeks once on
 * release; it never spams the host (or a transcoder) per drag tick. The host
 * element is the slider itself, carrying the ARIA the native input used to
 * provide for free. Handled keys stop propagating so the page's global
 * shortcuts don't double-seek.
 */
@Component({
  selector: 'jf-seek-bar',
  templateUrl: './seek-bar.html',
  host: {
    role: 'slider',
    tabindex: '0',
    'aria-orientation': 'horizontal',
    'aria-valuemin': '0',
    '[attr.aria-label]': 'label()',
    '[attr.aria-valuemax]': 'duration()',
    '[attr.aria-valuenow]': 'scrub.displayPosition()',
    '[attr.aria-valuetext]': 'scrub.valueText()',
    class:
      'group relative flex h-5 w-full cursor-pointer touch-none items-center outline-none ' +
      'focus-visible:ring-2 focus-visible:ring-accent',
    '(pointerdown)': 'onPointerDown($event)',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerup)': 'scrub.dragEnd()',
    '(pointerleave)': 'scrub.hoverEnd()',
    '(pointercancel)': 'scrub.dragCancel()',
    '(lostpointercapture)': 'scrub.dragCancel()',
    '(keydown)': 'onKeydown($event)',
  },
})
export class SeekBar {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Live playback position, seconds. */
  readonly position = input.required<number>();
  /** Item duration, seconds; the bar is inert until it's known. */
  readonly duration = input.required<number>();
  /** Chapter Marks to draw on the track; names feed the tooltip in a later issue. */
  readonly chapters = input<readonly Chapter[]>([]);
  readonly label = input('Seek');

  /**
   * Mark fractions along the track. A chapter starting at zero still exists
   * for lookup, but a tick at the track's edge marks nothing — skip it, along
   * with anything past the (possibly shorter, engine-reported) duration.
   */
  protected readonly marks = computed(() => {
    const duration = this.duration();
    if (duration <= 0) return [];
    return this.chapters()
      .filter((chapter) => chapter.startSeconds > 0 && chapter.startSeconds < duration)
      .map((chapter) => chapter.startSeconds / duration);
  });
  /** One committed seek per released drag or key press. Seconds. */
  readonly seekTo = output<number>();

  protected readonly scrub = createScrubInteraction({
    position: () => this.position(),
    duration: () => this.duration(),
    chapters: () => this.chapters(),
    commit: (seconds) => this.seekTo.emit(seconds),
  });

  protected onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    this.el.nativeElement.setPointerCapture(event.pointerId);
    this.scrub.dragStart(this.fractionAt(event));
  }

  protected onPointerMove(event: PointerEvent): void {
    const fraction = this.fractionAt(event);
    if (this.scrub.dragging()) this.scrub.dragMove(fraction);
    else this.scrub.hover(fraction);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.scrub.key(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
  }

  private fractionAt(event: PointerEvent): number {
    const rect = this.el.nativeElement.getBoundingClientRect();
    return rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
  }
}

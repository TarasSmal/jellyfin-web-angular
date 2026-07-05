import { Directive, TemplateRef, inject } from '@angular/core';

/**
 * Marks an element as one Rotator slide. Structural on purpose: slides are
 * templates, so the rotator instantiates only the ones it actually shows —
 * projected components would mount (and download images for) every slide.
 */
@Directive({ selector: '[jfRotatorSlide]' })
export class RotatorSlide {
  readonly template = inject<TemplateRef<unknown>>(TemplateRef);
}

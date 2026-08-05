import { Component } from '@angular/core';

/**
 * Sticky title strip for an admin page. Keeps the heading (and any header
 * actions projected with it) pinned under the app bar while the section
 * content scrolls beneath, matching the sticky section nav in `AdminShell`.
 * The negative top margin cancels its own padding so unscrolled pages keep
 * their original spacing.
 */
@Component({
  selector: 'jf-admin-page-header',
  templateUrl: './admin-page-header.html',
  host: { class: 'sticky top-16 z-20 -mt-4 block bg-bg py-4' },
})
export class AdminPageHeader {}

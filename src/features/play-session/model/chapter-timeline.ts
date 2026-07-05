import { BaseItemDto } from '@shared/api';
import { ticksToSeconds } from '@shared/lib/ticks';

/** A Chapter: a named position on the hosted item's timeline. Wire ticks stay behind this seam. */
export interface Chapter {
  name: string;
  startSeconds: number;
}

/**
 * The chapter containing a moment: the last one starting at or before it.
 * Null before the first chapter or when there are none.
 */
export function chapterAt(chapters: readonly Chapter[], seconds: number): Chapter | null {
  let containing: Chapter | null = null;
  for (const chapter of chapters) {
    if (chapter.startSeconds > seconds) break;
    containing = chapter;
  }
  return containing;
}

/** The hosted item's chapters, shaped for the seek bar. */
export function chaptersOf(item: BaseItemDto): Chapter[] {
  return (item.Chapters ?? [])
    .map((chapter) => ({
      name: chapter.Name,
      startSeconds: ticksToSeconds(chapter.StartPositionTicks),
    }))
    .sort((a, b) => a.startSeconds - b.startSeconds)
    .map((chapter, index) => ({
      name: chapter.name || `Chapter ${index + 1}`,
      startSeconds: chapter.startSeconds,
    }));
}

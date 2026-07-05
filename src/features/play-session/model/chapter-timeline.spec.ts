import { BaseItemDto } from '@shared/api';
import { chapterAt, chaptersOf } from './chapter-timeline';

function itemWith(chapters: NonNullable<BaseItemDto['Chapters']>): BaseItemDto {
  return { Id: 'movie-1', Name: 'A Movie', Type: 'Movie', Chapters: chapters } as BaseItemDto;
}

describe('chapter timeline', () => {
  it('names unnamed chapters "Chapter N" by timeline position', () => {
    const chapters = chaptersOf(
      itemWith([
        { StartPositionTicks: 0 },
        { StartPositionTicks: 9_000_000_000, Name: '' },
        { StartPositionTicks: 18_000_000_000, Name: 'Finale' },
      ]),
    );
    expect(chapters.map((chapter) => chapter.name)).toEqual(['Chapter 1', 'Chapter 2', 'Finale']);
  });

  it('orders chapters by start regardless of wire order', () => {
    const chapters = chaptersOf(
      itemWith([
        { StartPositionTicks: 18_000_000_000, Name: 'Late' },
        { StartPositionTicks: 0 },
        { StartPositionTicks: 9_000_000_000 },
      ]),
    );
    expect(chapters).toEqual([
      { name: 'Chapter 1', startSeconds: 0 },
      { name: 'Chapter 2', startSeconds: 900 },
      { name: 'Late', startSeconds: 1800 },
    ]);
  });

  it('yields no chapters for items without chapter metadata', () => {
    expect(chaptersOf({ Id: 'm', Name: 'M', Type: 'Movie' } as BaseItemDto)).toEqual([]);
    expect(chaptersOf(itemWith([]))).toEqual([]);
  });

  it('a chapter contains every moment from its start until the next start', () => {
    const chapters = [
      { name: 'Opening', startSeconds: 0 },
      { name: 'The Heist', startSeconds: 900 },
      { name: 'Finale', startSeconds: 1800 },
    ];
    expect(chapterAt(chapters, 450)?.name).toBe('Opening');
    expect(chapterAt(chapters, 900)?.name).toBe('The Heist'); // exactly on a start
    expect(chapterAt(chapters, 1799.9)?.name).toBe('The Heist');
  });

  it('no chapter contains moments before the first start, and the last runs to the end', () => {
    const chapters = [
      { name: 'Recap', startSeconds: 30 },
      { name: 'Finale', startSeconds: 1800 },
    ];
    expect(chapterAt(chapters, 10)).toBeNull();
    expect(chapterAt(chapters, 99_999)?.name).toBe('Finale');
    expect(chapterAt([], 10)).toBeNull();
  });

  it('shapes wire chapters into named starts in seconds', () => {
    const chapters = chaptersOf(
      itemWith([
        { StartPositionTicks: 0, Name: 'Opening' },
        { StartPositionTicks: 9_000_000_000, Name: 'The Heist' },
      ]),
    );
    expect(chapters).toEqual([
      { name: 'Opening', startSeconds: 0 },
      { name: 'The Heist', startSeconds: 900 },
    ]);
  });
});

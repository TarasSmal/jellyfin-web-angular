import { BaseItemDto } from '@shared/api';

/** Interleave two lists a-b-a-b, running out the longer one at the tail. */
function interleave(a: BaseItemDto[], b: BaseItemDto[]): BaseItemDto[] {
  const result: BaseItemDto[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i]) result.push(a[i]);
    if (b[i]) result.push(b[i]);
  }
  return result;
}

/** Pick the Featured Items the hero billboard rotates through. */
const hasBackdrop = (item: BaseItemDto): boolean => !!item.BackdropImageTags?.length;
const hasLogo = (item: BaseItemDto): boolean => !!item.ImageTags?.['Logo'];

const FEATURED_LIMIT = 5;

/** Pick the Featured Items the hero billboard rotates through. */
export function selectFeaturedItems(
  movies: BaseItemDto[],
  shows: BaseItemDto[],
): BaseItemDto[] {
  const eligibleMovies = movies.filter(hasBackdrop);
  const eligibleShows = shows.filter(hasBackdrop);
  // The Peacock look needs title logos; logo-less items are a last resort.
  const candidates = [
    ...interleave(eligibleMovies.filter(hasLogo), eligibleShows.filter(hasLogo)),
    ...interleave(
      eligibleMovies.filter((i) => !hasLogo(i)),
      eligibleShows.filter((i) => !hasLogo(i)),
    ),
  ];

  const seen = new Set<string>();
  const featured: BaseItemDto[] = [];
  for (const candidate of candidates) {
    if (featured.length === FEATURED_LIMIT) break;
    if (candidate.Id && seen.has(candidate.Id)) continue;
    if (candidate.Id) seen.add(candidate.Id);
    featured.push(candidate);
  }
  return featured;
}

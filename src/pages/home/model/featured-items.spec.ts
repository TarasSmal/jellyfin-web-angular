import { BaseItemDto } from '@shared/api';
import { selectFeaturedItems } from './featured-items';

function item(id: string, opts: { backdrop?: boolean; logo?: boolean } = {}): BaseItemDto {
  const { backdrop = true, logo = true } = opts;
  return {
    Id: id,
    Name: id,
    BackdropImageTags: backdrop ? [`tag-${id}`] : [],
    ImageTags: logo ? { Logo: `logo-${id}` } : {},
  } as BaseItemDto;
}

function ids(items: BaseItemDto[]): (string | undefined)[] {
  return items.map((i) => i.Id);
}

describe('selectFeaturedItems', () => {
  it('alternates movies and shows so both sides of the library are showcased', () => {
    const featured = selectFeaturedItems(
      [item('m1'), item('m2')],
      [item('s1'), item('s2')],
    );

    expect(ids(featured)).toEqual(['m1', 's1', 'm2', 's2']);
  });

  it('never features an item without backdrop art', () => {
    const featured = selectFeaturedItems(
      [item('m1', { backdrop: false }), item('m2')],
      [item('s1'), item('s2', { backdrop: false })],
    );

    expect(ids(featured)).toEqual(['m2', 's1']);
  });

  it('puts items with a title logo first; logo-less ones only fill the tail', () => {
    const featured = selectFeaturedItems(
      [item('m1', { logo: false }), item('m2')],
      [item('s1'), item('s2', { logo: false })],
    );

    expect(ids(featured)).toEqual(['m2', 's1', 'm1', 's2']);
  });

  it('features a title at most once, even when it appears in both lists', () => {
    const featured = selectFeaturedItems([item('x'), item('m1')], [item('x'), item('s1')]);

    expect(ids(featured)).toEqual(['x', 'm1', 's1']);
  });

  it('caps the set at five', () => {
    const movies = ['m1', 'm2', 'm3', 'm4'].map((id) => item(id));
    const shows = ['s1', 's2', 's3', 's4'].map((id) => item(id));

    expect(ids(selectFeaturedItems(movies, shows))).toEqual(['m1', 's1', 'm2', 's2', 'm3']);
  });

  it('returns an empty set when nothing qualifies', () => {
    expect(selectFeaturedItems([], [])).toEqual([]);
    expect(selectFeaturedItems([item('m1', { backdrop: false })], [])).toEqual([]);
  });
});

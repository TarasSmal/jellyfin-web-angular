import { describe, expect, it, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ApiConfig, BaseItemDto } from '@shared/api';
import {
  itemBackdropHash,
  itemBackdropSrcset,
  itemBackdropUrl,
  itemPosterHash,
  itemPosterSrcset,
  itemPosterUrl,
  itemThumbHash,
  itemThumbSrcset,
  studioImageUrl,
} from './item-images';

function item(partial: Partial<BaseItemDto>): BaseItemDto {
  return { Id: 'id', Name: 'Item', Type: 'Movie', ...partial };
}

describe('item images', () => {
  let config: ApiConfig;

  beforeEach(() => {
    TestBed.resetTestingModule();
    config = TestBed.inject(ApiConfig);
    config.setServer('http://jf.test');
  });

  describe('itemPosterUrl', () => {
    it('requests WebP at quality 90', () => {
      expect(itemPosterUrl(config, item({ Id: 'abc', ImageTags: { Primary: 'tag1' } }))).toBe(
        'http://jf.test/Items/abc/Images/Primary?tag=tag1&fillHeight=480&quality=90&format=Webp',
      );
    });

    it('falls back to the series poster for episodes', () => {
      const episode = item({ Id: 'ep1', SeriesId: 'ser1', SeriesPrimaryImageTag: 'stag' });
      expect(itemPosterUrl(config, episode)).toBe(
        'http://jf.test/Items/ser1/Images/Primary?tag=stag&fillHeight=480&quality=90&format=Webp',
      );
    });

    it('returns null without a usable tag', () => {
      expect(itemPosterUrl(config, item({ Id: 'x' }))).toBeNull();
    });
  });

  describe('itemBackdropUrl', () => {
    it('requests WebP at reduced quality 80', () => {
      expect(itemBackdropUrl(config, item({ Id: 'abc', BackdropImageTags: ['btag'] }))).toBe(
        'http://jf.test/Items/abc/Images/Backdrop/0?tag=btag&fillWidth=1920&quality=80&format=Webp',
      );
    });

    it('falls back to the parent backdrop at the same quality', () => {
      const episode = item({
        Id: 'ep1',
        ParentBackdropItemId: 'ser1',
        ParentBackdropImageTags: ['ptag'],
      });
      expect(itemBackdropUrl(config, episode)).toBe(
        'http://jf.test/Items/ser1/Images/Backdrop/0?tag=ptag&fillWidth=1920&quality=80&format=Webp',
      );
    });
  });

  describe('studioImageUrl', () => {
    it('builds the by-name studio image URL', () => {
      expect(studioImageUrl(config, 'NBC')).toBe(
        'http://jf.test/Studios/NBC/Images/Primary?maxHeight=96&quality=90&format=Webp',
      );
    });

    it('URL-encodes the studio name', () => {
      expect(studioImageUrl(config, '20th Century Fox')).toBe(
        'http://jf.test/Studios/20th%20Century%20Fox/Images/Primary?maxHeight=96&quality=90&format=Webp',
      );
    });

    it('accepts a custom max height', () => {
      expect(studioImageUrl(config, 'HBO', 48)).toContain('maxHeight=48');
    });
  });

  describe('srcset builders', () => {
    it('poster srcset offers 1x and 2x DPR variants', () => {
      const movie = item({ Id: 'abc', ImageTags: { Primary: 'tag1' } });
      expect(itemPosterSrcset(config, movie)).toBe(
        'http://jf.test/Items/abc/Images/Primary?tag=tag1&fillHeight=480&quality=90&format=Webp 1x, ' +
          'http://jf.test/Items/abc/Images/Primary?tag=tag1&fillHeight=960&quality=90&format=Webp 2x',
      );
    });

    it('backdrop srcset offers width variants for a 100vw hero', () => {
      const movie = item({ Id: 'abc', BackdropImageTags: ['btag'] });
      expect(itemBackdropSrcset(config, movie)).toBe(
        'http://jf.test/Items/abc/Images/Backdrop/0?tag=btag&fillWidth=1280&quality=80&format=Webp 1280w, ' +
          'http://jf.test/Items/abc/Images/Backdrop/0?tag=btag&fillWidth=1920&quality=80&format=Webp 1920w, ' +
          'http://jf.test/Items/abc/Images/Backdrop/0?tag=btag&fillWidth=2560&quality=80&format=Webp 2560w',
      );
    });

    it('thumb srcset doubles the requested width', () => {
      const episode = item({ Type: 'Episode', ImageTags: { Primary: 'p1' } });
      expect(itemThumbSrcset(config, episode, 400)).toBe(
        'http://jf.test/Items/id/Images/Primary?tag=p1&fillWidth=400&quality=90&format=Webp 1x, ' +
          'http://jf.test/Items/id/Images/Primary?tag=p1&fillWidth=800&quality=90&format=Webp 2x',
      );
    });

    it('returns null when the item has no usable image', () => {
      expect(itemPosterSrcset(config, item({}))).toBeNull();
      expect(itemBackdropSrcset(config, item({}))).toBeNull();
    });
  });

  describe('blurhash lookups', () => {
    it('resolves the poster hash by primary tag', () => {
      const movie = item({
        ImageTags: { Primary: 'p1' },
        ImageBlurHashes: { Primary: { p1: 'hash-p1' } },
      });
      expect(itemPosterHash(movie)).toBe('hash-p1');
    });

    it('resolves the series poster hash for episodes, same as the URL fallback', () => {
      const episode = item({
        Type: 'Episode',
        SeriesId: 'ser1',
        SeriesPrimaryImageTag: 'sp1',
        ImageBlurHashes: { Primary: { sp1: 'hash-series' } },
      });
      expect(itemPosterHash(episode)).toBe('hash-series');
    });

    it('resolves the backdrop hash with parent fallback', () => {
      const episode = item({
        ParentBackdropItemId: 'ser1',
        ParentBackdropImageTags: ['pb1'],
        ImageBlurHashes: { Backdrop: { pb1: 'hash-parent' } },
      });
      expect(itemBackdropHash(episode)).toBe('hash-parent');
    });

    it('thumb hash mirrors the thumb → episode still → backdrop chain', () => {
      const withThumb = item({
        ImageTags: { Thumb: 't1' },
        ImageBlurHashes: { Thumb: { t1: 'hash-thumb' } },
      });
      expect(itemThumbHash(withThumb)).toBe('hash-thumb');

      const episodeStill = item({
        Type: 'Episode',
        ImageTags: { Primary: 'p1' },
        ImageBlurHashes: { Primary: { p1: 'hash-still' } },
      });
      expect(itemThumbHash(episodeStill)).toBe('hash-still');

      const backdropOnly = item({
        BackdropImageTags: ['b1'],
        ImageBlurHashes: { Backdrop: { b1: 'hash-backdrop' } },
      });
      expect(itemThumbHash(backdropOnly)).toBe('hash-backdrop');
    });

    it('returns null when the item has no hashes', () => {
      expect(itemPosterHash(item({ ImageTags: { Primary: 'p1' } }))).toBeNull();
      expect(itemBackdropHash(item({}))).toBeNull();
    });
  });
});

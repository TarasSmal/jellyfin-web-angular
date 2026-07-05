import { describe, expect, it, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ApiConfig } from '@shared/api';
import { studioImageUrl } from './item-images';

describe('studioImageUrl', () => {
  let config: ApiConfig;

  beforeEach(() => {
    TestBed.resetTestingModule();
    config = TestBed.inject(ApiConfig);
    config.setServer('http://jf.test');
  });

  it('builds the by-name studio image URL', () => {
    expect(studioImageUrl(config, 'NBC')).toBe(
      'http://jf.test/Studios/NBC/Images/Primary?maxHeight=96&quality=90',
    );
  });

  it('URL-encodes the studio name', () => {
    expect(studioImageUrl(config, '20th Century Fox')).toBe(
      'http://jf.test/Studios/20th%20Century%20Fox/Images/Primary?maxHeight=96&quality=90',
    );
  });

  it('accepts a custom max height', () => {
    expect(studioImageUrl(config, 'HBO', 48)).toContain('maxHeight=48');
  });
});

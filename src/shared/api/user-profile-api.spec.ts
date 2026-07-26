import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiConfig } from './api-config';
import { currentUserRequest, userImageUrl } from './user-profile-api';

describe('user profile requests', () => {
  let config: ApiConfig;

  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
    config = TestBed.inject(ApiConfig);
    config.setServer('http://jf.test');
  });

  describe('currentUserRequest', () => {
    it('idles while unauthenticated', () => {
      expect(currentUserRequest(config)).toBeUndefined();
    });

    it('reads the token-owning account', () => {
      config.setSession('token', 'user-1');
      expect(currentUserRequest(config)).toEqual({ url: 'http://jf.test/Users/Me' });
    });
  });

  describe('userImageUrl', () => {
    it('busts the cache with the image tag', () => {
      expect(userImageUrl(config, { Id: 'user-1', PrimaryImageTag: 'tag1' })).toBe(
        'http://jf.test/UserImage?userId=user-1&tag=tag1',
      );
    });

    it('returns null for an account without a picture', () => {
      expect(userImageUrl(config, { Id: 'user-1' })).toBeNull();
    });
  });
});

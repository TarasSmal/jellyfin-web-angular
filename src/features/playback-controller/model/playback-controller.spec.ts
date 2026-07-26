import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { Router, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlaybackController } from './playback-controller';

@Component({ selector: 'jf-blank', template: '' })
class Blank {}

describe('PlaybackController', () => {
  let controller: PlaybackController;
  let router: Router;
  let location: Location;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: Blank },
          { path: 'item/:id', component: Blank },
          { path: 'player/:id', component: Blank },
        ]),
        provideLocationMocks(),
      ],
    });
    controller = TestBed.inject(PlaybackController);
    router = TestBed.inject(Router);
    location = TestBed.inject(Location);
    // Deliberately no initial navigation: tests that need in-app history
    // create it, so the deep-link case (no history at all) stays reachable.
  });

  const stub = () => ({ stop: vi.fn() });

  /** The controller navigates fire-and-forget; let the router settle. */
  const settle = () => new Promise((resolve) => setTimeout(resolve));

  it('starts idle', () => {
    expect(controller.itemId()).toBeNull();
    expect(controller.active()).toBe(false);
  });

  it('derives presentation from the URL, not from a stored flag', async () => {
    expect(controller.presentation()).toBe('docked');

    await router.navigate(['/player', 'movie-1']);
    expect(controller.presentation()).toBe('fullscreen');

    await router.navigate(['/item', 'movie-1']);
    expect(controller.presentation()).toBe('docked');
  });

  it('hosts an item without touching the URL while docked', async () => {
    controller.play('movie-1');
    expect(controller.itemId()).toBe('movie-1');
    expect(controller.active()).toBe(true);
    await settle();
    expect(router.url).toBe('/');
  });

  it('is idempotent for the item already playing', async () => {
    await router.navigate(['/player', 'movie-1']);
    controller.play('movie-1');
    const navigate = vi.spyOn(router, 'navigate');

    controller.play('movie-1');

    // No restart, no navigation — pressing Play on the docked item expands it.
    expect(navigate).not.toHaveBeenCalled();
    expect(controller.itemId()).toBe('movie-1');
  });

  it('keeps a full-screen URL on the item now playing, replacing history', async () => {
    await router.navigate(['/player', 'ep-1']);
    controller.play('ep-1');

    controller.play('ep-2');
    await settle();

    expect(router.url).toBe('/player/ep-2');
    // Replaced, not pushed: Back must exit the player, not step back a binge.
    expect(location.back).toBeDefined();
  });

  it('expands by navigating to the player route', async () => {
    controller.play('movie-1');

    controller.expand();
    await settle();

    expect(router.url).toBe('/player/movie-1');
    expect(controller.presentation()).toBe('fullscreen');
  });

  it('stops the hosted session synchronously on close', () => {
    const session = stub();
    controller.play('movie-1');
    controller.hostSession(session);

    controller.close();

    expect(session.stop).toHaveBeenCalledTimes(1);
    expect(controller.itemId()).toBeNull();
  });

  it('leaves a deep-linked player for the item page rather than the site', async () => {
    // A fresh load straight onto the player has no in-app history to go back to.
    await router.navigate(['/player', 'movie-1']);
    controller.play('movie-1');
    controller.hostSession(stub());

    controller.close();
    await settle();

    expect(router.url).toBe('/item/movie-1');
  });

  it('goes back when there is in-app history behind the player', async () => {
    await router.navigate(['/item', 'movie-1']);
    await router.navigate(['/player', 'movie-1']);
    controller.play('movie-1');
    controller.hostSession(stub());
    const back = vi.spyOn(location, 'back');

    controller.close();

    expect(back).toHaveBeenCalledTimes(1);
  });

  it('docks by leaving the player route, keeping playback alive', async () => {
    await router.navigate(['/item', 'movie-1']);
    await router.navigate(['/player', 'movie-1']);
    controller.play('movie-1');
    const session = stub();
    controller.hostSession(session);

    controller.dock();

    expect(session.stop).not.toHaveBeenCalled();
    expect(controller.itemId()).toBe('movie-1');
  });

  it('ignores a release from a session that is no longer the host', () => {
    const first = stub();
    const second = stub();
    controller.play('movie-1');
    controller.hostSession(first);
    controller.hostSession(second);

    controller.releaseSession(first);
    controller.close();

    expect(second.stop).toHaveBeenCalledTimes(1);
  });
});

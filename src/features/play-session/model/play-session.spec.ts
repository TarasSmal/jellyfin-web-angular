import {
  EnvironmentInjector,
  createEnvironmentInjector,
  runInInjectionContext,
  signal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { ApiConfig, BaseItemDto, PlaybackApi, SessionProgress } from '@shared/api';
import { secondsToTicks } from '@shared/lib/ticks';
import { MEDIA_ENGINE, MediaEngine, StreamSource, VideoSurface } from './media-engine';
import { PlaySession, createPlaySession } from './play-session';

/** Plain object satisfying the video-surface contract; dispatches real events. */
class StubVideo implements VideoSurface {
  currentTime = 0;
  duration = 0;
  paused = true;
  volume = 1;
  muted = false;
  src = '';
  private readonly listeners = new Map<string, Set<EventListener>>();

  canPlayType(): string {
    return '';
  }
  play(): Promise<void> {
    this.paused = false;
    this.emit('play');
    return Promise.resolve();
  }
  pause(): void {
    this.paused = true;
    this.emit('pause');
  }
  addEventListener(type: string, listener: EventListener): void {
    let set = this.listeners.get(type);
    if (!set) this.listeners.set(type, (set = new Set()));
    set.add(listener);
  }
  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }
  emit(type: string): void {
    this.listeners.get(type)?.forEach((l) => l(new Event(type)));
  }
}

/** Spy playback API: records report order + payloads and hands out stream URLs. */
function makeApi() {
  const log: string[] = [];
  let seq = 0;
  const api = {
    getPlaybackInfo: vi.fn(() =>
      Promise.resolve({
        MediaSources: [
          {
            Id: 'src',
            Container: 'mp4',
            SupportsDirectPlay: true,
            DefaultAudioStreamIndex: 1,
            MediaStreams: [
              { Index: 1, Type: 'Audio', DisplayTitle: 'English' },
              { Index: 2, Type: 'Audio', DisplayTitle: 'French' },
              { Index: 3, Type: 'Subtitle', IsTextSubtitleStream: true, DisplayTitle: 'English' },
            ],
          },
        ],
        PlaySessionId: `ps-${++seq}`,
      }),
    ),
    directStreamUrl: vi.fn(() => 'http://stream/direct'),
    transcodeUrl: vi.fn(() => 'http://stream/transcode'),
    subtitleUrl: vi.fn(() => 'http://stream/sub.vtt'),
    reportStart: vi.fn((p: SessionProgress) => {
      log.push(`start:${p.playSessionId}@${p.positionSeconds}`);
      return Promise.resolve();
    }),
    reportProgress: vi.fn((p: SessionProgress) => {
      log.push(`progress:${p.playSessionId}`);
      return Promise.resolve();
    }),
    reportStopped: vi.fn((p: SessionProgress) => {
      log.push(`stopped:${p.playSessionId}@${p.positionSeconds}`);
      return Promise.resolve();
    }),
  };
  return { api, log };
}

/** Fake media engine: records attachments and can fire a fatal error. */
function makeEngine() {
  const attachments: { url: string; detached: boolean }[] = [];
  let onFatal: (() => void) | null = null;
  const engine: MediaEngine = {
    attach(_surface: VideoSurface, source: StreamSource, fatal: () => void) {
      const record = { url: source.url, detached: false };
      attachments.push(record);
      onFatal = fatal;
      return { detach: () => (record.detached = true) };
    },
  };
  return { engine, attachments, fatal: () => onFatal?.() };
}

function itemDto(id: string, resumeTicks = 0): BaseItemDto {
  return {
    Id: id,
    Name: 'Movie',
    Type: 'Movie',
    UserData: { PlaybackPositionTicks: resumeTicks },
  } as BaseItemDto;
}

describe('PlaySession', () => {
  let http: HttpTestingController;
  let scope: EnvironmentInjector | null;
  let itemId: ReturnType<typeof signal<string>>;
  let surface: ReturnType<typeof signal<VideoSurface | null>>;
  let api: ReturnType<typeof makeApi>['api'];
  let log: string[];
  let engine: MediaEngine;
  let attachments: { url: string; detached: boolean }[];
  let fatal: () => void;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    TestBed.resetTestingModule();
    ({ api, log } = makeApi());
    ({ engine, attachments, fatal } = makeEngine());
    itemId = signal('movie-1');
    surface = signal<VideoSurface | null>(null);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PlaybackApi, useValue: api },
        { provide: MEDIA_ENGINE, useValue: engine },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const config = TestBed.inject(ApiConfig);
    config.setServer('http://jf.test');
    config.setSession('token', 'user-1');
    scope = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
  });

  afterEach(() => {
    scope?.destroy();
    scope = null;
    http.verify();
    vi.useRealTimers();
  });

  function create(): PlaySession {
    if (!scope) throw new Error('scope destroyed');
    const session = runInInjectionContext(scope, () =>
      createPlaySession(
        () => itemId(),
        () => surface(),
      ),
    );
    TestBed.tick();
    return session;
  }

  /** Real macrotask drains microtasks (async resolution) then flushes effects. */
  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
  }

  /** Create a session, deliver the item, attach the surface, start the session. */
  async function boot(video: StubVideo, resumeTicks = 0): Promise<PlaySession> {
    const session = create();
    http.expectOne((r) => r.url === 'http://jf.test/Items/movie-1').flush(itemDto('movie-1', resumeTicks));
    await settle();
    surface.set(video);
    await settle();
    await settle();
    return session;
  }

  it('stays idle until both the item and the surface are ready', async () => {
    create();
    expect(api.getPlaybackInfo).not.toHaveBeenCalled();

    http.expectOne((r) => r.url === 'http://jf.test/Items/movie-1').flush(itemDto('movie-1'));
    await settle();
    // item ready, surface still missing → no playback work yet
    expect(api.getPlaybackInfo).not.toHaveBeenCalled();
    expect(api.reportStart).not.toHaveBeenCalled();

    surface.set(new StubVideo());
    await settle();
    await settle();
    expect(api.reportStart).toHaveBeenCalledTimes(1);
    expect(attachments).toHaveLength(1);
  });

  it('seeks to the recorded resume position once metadata loads', async () => {
    const video = new StubVideo();
    await boot(video, secondsToTicks(120));

    expect(video.currentTime).toBe(0);
    video.emit('loadedmetadata');
    expect(video.currentTime).toBe(120);
  });

  it('reports progress every 10s while playing and suppresses it while paused', async () => {
    const video = new StubVideo();
    await boot(video);
    video.play();
    await settle();

    log.length = 0;
    vi.advanceTimersByTime(10_000);
    expect(log).toEqual(['progress:ps-1']);

    video.pause();
    log.length = 0; // drop the immediate pause report
    vi.advanceTimersByTime(20_000);
    expect(log).toEqual([]);
  });

  it('reports immediately on pause and resume', async () => {
    const video = new StubVideo();
    await boot(video);
    log.length = 0;

    video.play();
    expect(log).toEqual(['progress:ps-1']);
    video.pause();
    expect(log).toEqual(['progress:ps-1', 'progress:ps-1']);
  });

  it('rotates atomically on audio switch: Stopped before Start, position carried, old timer dead', async () => {
    const video = new StubVideo();
    const session = await boot(video);
    video.play();
    await settle();
    video.currentTime = 45;
    video.emit('timeupdate');

    log.length = 0;
    await session.selectAudio(2);

    expect(log[0]).toBe('stopped:ps-1@45'); // old session honestly stopped first
    expect(log[1]).toBe('start:ps-2@45'); // new session resumes at carried position
    expect(attachments).toHaveLength(2);
    expect(attachments[0].detached).toBe(true); // old attachment released
    expect(session.selectedAudio()).toBe(2);

    log.length = 0;
    vi.advanceTimersByTime(10_000);
    expect(log).toEqual(['progress:ps-2']); // only the new timer survives
  });

  it('ignores a second audio switch while one is in flight', async () => {
    const video = new StubVideo();
    const session = await boot(video);

    const first = session.selectAudio(2);
    const second = session.selectAudio(3); // dropped: single-flight
    await Promise.all([first, second]);
    await settle();

    expect(api.getPlaybackInfo).toHaveBeenCalledTimes(2); // initial + one switch
    expect(session.selectedAudio()).toBe(2);
  });

  it('stops exactly once when stop() is called twice', async () => {
    const video = new StubVideo();
    const session = await boot(video);
    log.length = 0;

    session.stop();
    session.stop();

    expect(api.reportStopped).toHaveBeenCalledTimes(1);
  });

  it('sends exactly one Stopped when the host is destroyed', async () => {
    const video = new StubVideo();
    await boot(video);

    scope?.destroy();
    scope = null;
    expect(api.reportStopped).toHaveBeenCalledTimes(1);
  });

  it('keeps playback alive when a report request fails', async () => {
    api.reportProgress.mockImplementation(() => Promise.reject(new Error('network')));
    const video = new StubVideo();
    const session = await boot(video);
    video.play();
    await settle();

    vi.advanceTimersByTime(10_000); // a failing progress report
    await settle();

    expect(session.error()).toBe(false);
    expect(session.playing()).toBe(true);
  });

  it('goes quiescent after a fatal media error', async () => {
    const video = new StubVideo();
    const session = await boot(video);
    video.play();
    await settle();

    log.length = 0;
    fatal();
    expect(session.error()).toBe(true);
    expect(api.reportStopped).toHaveBeenCalledTimes(1); // session ended

    log.length = 0;
    vi.advanceTimersByTime(30_000);
    expect(log).toEqual([]); // no reports after Stopped
  });

  it('rotates to a fresh session when the item id changes', async () => {
    const video = new StubVideo();
    await boot(video);
    log.length = 0;

    itemId.set('movie-2');
    TestBed.tick();
    http.expectOne((r) => r.url === 'http://jf.test/Items/movie-2').flush(itemDto('movie-2'));
    await settle();
    await settle();

    expect(log.some((e) => e.startsWith('stopped:ps-1'))).toBe(true);
    expect(log.some((e) => e.startsWith('start:ps-2'))).toBe(true);
  });

  it('exposes track labels with fallbacks resolved behind the interface', async () => {
    const video = new StubVideo();
    const session = await boot(video);

    expect(session.audioTracks()).toEqual([
      { index: 1, label: 'English' },
      { index: 2, label: 'French' },
    ]);
    expect(session.subtitleTracks()).toEqual([{ index: 3, label: 'English' }]);

    session.selectSubtitle(3);
    expect(session.activeSubtitle()).toEqual([{ url: 'http://stream/sub.vtt', label: 'English' }]);
  });
});

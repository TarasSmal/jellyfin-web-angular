import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiConfig } from './api-config';
import { PlaybackApi, SessionProgress } from './playback-api';

describe('PlaybackApi reporting', () => {
  let http: HttpTestingController;
  let api: PlaybackApi;

  const progress: SessionProgress = {
    itemId: 'item-1',
    mediaSourceId: 'source-1',
    playSessionId: 'sess-1',
    positionSeconds: 30,
    paused: false,
    playMethod: 'Transcode',
    audioStreamIndex: 2,
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(ApiConfig).setServer('http://jf.test');
    api = TestBed.inject(PlaybackApi);
  });

  afterEach(() => http.verify());

  it('reportStart posts the wire DTO to /Sessions/Playing with ticks and seekability', async () => {
    const done = api.reportStart(progress);

    const req = http.expectOne('http://jf.test/Sessions/Playing');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      ItemId: 'item-1',
      MediaSourceId: 'source-1',
      PlaySessionId: 'sess-1',
      PositionTicks: 300_000_000, // 30s × 10,000,000 ticks/s
      IsPaused: false,
      PlayMethod: 'Transcode',
      AudioStreamIndex: 2,
      CanSeek: true,
    });
    req.flush(null);
    await done;
  });

  it('reportProgress posts to /Sessions/Playing/Progress and carries the pause flag', async () => {
    const done = api.reportProgress({ ...progress, paused: true });

    const req = http.expectOne('http://jf.test/Sessions/Playing/Progress');
    expect(req.request.body.IsPaused).toBe(true);
    req.flush(null);
    await done;
  });

  it('reportStopped posts to /Sessions/Playing/Stopped', async () => {
    const done = api.reportStopped(progress);

    http.expectOne('http://jf.test/Sessions/Playing/Stopped').flush(null);
    await done;
  });

  it('resolves (never rejects) when the report request fails', async () => {
    const done = api.reportStart(progress);

    http
      .expectOne('http://jf.test/Sessions/Playing')
      .flush('nope', { status: 500, statusText: 'Server Error' });

    await expect(done).resolves.toBeUndefined();
  });
});

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiConfig } from './api-config';
import { getDeviceId } from '../lib/device-id';

export interface MediaStreamDto {
  Index: number;
  Type: 'Video' | 'Audio' | 'Subtitle' | (string & {});
  Codec?: string;
  Language?: string;
  DisplayTitle?: string;
  Title?: string;
  IsDefault?: boolean;
  IsExternal?: boolean;
  IsTextSubtitleStream?: boolean;
  DeliveryMethod?: string;
  DeliveryUrl?: string;
}

export interface MediaSourceInfo {
  Id: string;
  Container?: string;
  RunTimeTicks?: number;
  SupportsDirectPlay?: boolean;
  SupportsDirectStream?: boolean;
  SupportsTranscoding?: boolean;
  TranscodingUrl?: string;
  TranscodingSubProtocol?: string;
  MediaStreams?: MediaStreamDto[];
  DefaultAudioStreamIndex?: number;
  DefaultSubtitleStreamIndex?: number;
}

export interface PlaybackInfoResponse {
  MediaSources: MediaSourceInfo[];
  PlaySessionId: string;
}

export type PlayMethod = 'DirectPlay' | 'DirectStream' | 'Transcode';

export interface PlaybackReport {
  ItemId: string;
  MediaSourceId: string;
  PlaySessionId: string;
  PositionTicks: number;
  IsPaused?: boolean;
  PlayMethod?: PlayMethod;
  AudioStreamIndex?: number;
  CanSeek?: boolean;
}

/**
 * What this browser client can play natively; anything else the server
 * transcodes to h264/aac HLS. Kept deliberately coarse — the browser's
 * real answer comes from it actually playing the stream.
 */
const DEVICE_PROFILE = {
  MaxStreamingBitrate: 120_000_000,
  DirectPlayProfiles: [
    { Container: 'mp4,m4v', Type: 'Video', VideoCodec: 'h264,hevc,av1,vp9', AudioCodec: 'aac,mp3,opus,flac' },
    { Container: 'webm', Type: 'Video', VideoCodec: 'vp8,vp9,av1', AudioCodec: 'vorbis,opus' },
    { Container: 'mkv', Type: 'Video', VideoCodec: 'h264,hevc,av1,vp9', AudioCodec: 'aac,mp3,opus,flac' },
  ],
  TranscodingProfiles: [
    {
      Container: 'ts',
      Type: 'Video',
      VideoCodec: 'h264',
      AudioCodec: 'aac,mp3',
      Context: 'Streaming',
      Protocol: 'hls',
      MaxAudioChannels: '2',
      MinSegments: 1,
      BreakOnNonKeyFrames: true,
    },
  ],
  SubtitleProfiles: [
    { Format: 'vtt', Method: 'External' },
    { Format: 'srt', Method: 'External' },
  ],
};

export interface PlaybackInfoOptions {
  audioStreamIndex?: number;
  subtitleStreamIndex?: number;
}

@Injectable({ providedIn: 'root' })
export class PlaybackApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ApiConfig);

  getPlaybackInfo(itemId: string, options: PlaybackInfoOptions = {}): Promise<PlaybackInfoResponse> {
    return firstValueFrom(
      this.http.post<PlaybackInfoResponse>(
        this.config.url(`/Items/${itemId}/PlaybackInfo`),
        {
          DeviceProfile: DEVICE_PROFILE,
          AutoOpenLiveStream: true,
          AudioStreamIndex: options.audioStreamIndex,
          SubtitleStreamIndex: options.subtitleStreamIndex,
        },
        { params: { userId: this.config.userId() ?? '' } },
      ),
    );
  }

  /**
   * Media elements can't send the Authorization header, so stream URLs
   * carry the token as api_key.
   */
  directStreamUrl(itemId: string, source: MediaSourceInfo, playSessionId: string): string {
    const params = new URLSearchParams({
      static: 'true',
      mediaSourceId: source.Id,
      deviceId: getDeviceId(),
      playSessionId,
      api_key: this.config.accessToken() ?? '',
    });
    return `${this.config.url(`/Videos/${itemId}/stream.${source.Container ?? 'mp4'}`)}?${params}`;
  }

  transcodeUrl(source: MediaSourceInfo): string | null {
    if (!source.TranscodingUrl) return null;
    let url = this.config.url(source.TranscodingUrl);
    if (!url.includes('api_key=')) {
      url += `${url.includes('?') ? '&' : '?'}api_key=${this.config.accessToken() ?? ''}`;
    }
    return url;
  }

  /** External text subtitle as WebVTT (server converts srt/subrip on the fly). */
  subtitleUrl(itemId: string, mediaSourceId: string, streamIndex: number): string {
    return `${this.config.url(
      `/Videos/${itemId}/${mediaSourceId}/Subtitles/${streamIndex}/0/Stream.vtt`,
    )}?api_key=${this.config.accessToken() ?? ''}`;
  }

  reportStart(report: PlaybackReport): Promise<void> {
    return firstValueFrom(this.http.post<void>(this.config.url('/Sessions/Playing'), report));
  }

  reportProgress(report: PlaybackReport): Promise<void> {
    return firstValueFrom(this.http.post<void>(this.config.url('/Sessions/Playing/Progress'), report));
  }

  reportStopped(report: PlaybackReport): Promise<void> {
    return firstValueFrom(this.http.post<void>(this.config.url('/Sessions/Playing/Stopped'), report));
  }
}

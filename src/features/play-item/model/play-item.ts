import { Injectable, inject } from '@angular/core';
import { MediaSourceInfo, PlayMethod, PlaybackApi, PlaybackInfoOptions } from '@shared/api';

export interface ResolvedStream {
  url: string;
  method: PlayMethod;
  isHls: boolean;
  mediaSource: MediaSourceInfo;
  playSessionId: string;
}

@Injectable({ providedIn: 'root' })
export class PlayItem {
  private readonly playbackApi = inject(PlaybackApi);

  /**
   * Ask the server how to play an item, preferring the original file.
   * The server has already matched sources against our device profile.
   */
  async resolve(itemId: string, options: PlaybackInfoOptions = {}): Promise<ResolvedStream> {
    const info = await this.playbackApi.getPlaybackInfo(itemId, options);
    const source = info.MediaSources[0];
    if (!source) throw new Error('No media sources for this item');

    if (source.SupportsDirectPlay) {
      return {
        url: this.playbackApi.directStreamUrl(itemId, source, info.PlaySessionId),
        method: 'DirectPlay',
        isHls: false,
        mediaSource: source,
        playSessionId: info.PlaySessionId,
      };
    }

    const transcodeUrl = this.playbackApi.transcodeUrl(source);
    if (transcodeUrl) {
      return {
        url: transcodeUrl,
        method: 'Transcode',
        isHls: source.TranscodingSubProtocol === 'hls' || transcodeUrl.includes('.m3u8'),
        mediaSource: source,
        playSessionId: info.PlaySessionId,
      };
    }

    if (source.SupportsDirectStream) {
      return {
        url: this.playbackApi.directStreamUrl(itemId, source, info.PlaySessionId),
        method: 'DirectStream',
        isHls: false,
        mediaSource: source,
        playSessionId: info.PlaySessionId,
      };
    }

    throw new Error('Server offered no playable stream');
  }
}

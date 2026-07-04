import { MediaSourceInfo, PlayMethod, PlaybackApi, PlaybackInfoOptions } from '@shared/api';

/**
 * A stream the server offered for one item, ready to attach. Private to the
 * Play Session module — no page ever sees a media-source wire shape or the
 * PlaySessionId.
 */
export interface ResolvedStream {
  url: string;
  method: PlayMethod;
  isHls: boolean;
  mediaSource: MediaSourceInfo;
  playSessionId: string;
}

/**
 * Ask the server how to play an item, preferring the original file
 * (Direct Play → Transcode → Direct Stream). The server has already matched
 * sources against our device profile.
 */
export async function resolveStream(
  api: PlaybackApi,
  itemId: string,
  options: PlaybackInfoOptions = {},
): Promise<ResolvedStream> {
  const info = await api.getPlaybackInfo(itemId, options);
  const source = info.MediaSources[0];
  if (!source) throw new Error('No media sources for this item');

  if (source.SupportsDirectPlay) {
    return {
      url: api.directStreamUrl(itemId, source, info.PlaySessionId),
      method: 'DirectPlay',
      isHls: false,
      mediaSource: source,
      playSessionId: info.PlaySessionId,
    };
  }

  const transcodeUrl = api.transcodeUrl(source);
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
      url: api.directStreamUrl(itemId, source, info.PlaySessionId),
      method: 'DirectStream',
      isHls: false,
      mediaSource: source,
      playSessionId: info.PlaySessionId,
    };
  }

  throw new Error('Server offered no playable stream');
}

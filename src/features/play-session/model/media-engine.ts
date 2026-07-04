import { InjectionToken } from '@angular/core';
import Hls from 'hls.js';

/**
 * The minimal video-element contract the Play Session module binds to. A real
 * `HTMLVideoElement` satisfies it structurally; tests pass a plain stub. State
 * flows out through the read-only members; commands go in through the writable
 * ones and the methods.
 */
export interface VideoSurface {
  currentTime: number;
  readonly duration: number;
  readonly paused: boolean;
  volume: number;
  muted: boolean;
  src: string;
  play(): Promise<void>;
  pause(): void;
  canPlayType(type: string): string;
  addEventListener(type: string, listener: EventListener, options?: AddEventListenerOptions): void;
  removeEventListener(type: string, listener: EventListener): void;
}

/** What a media engine needs to attach a stream — nothing of the Play Session. */
export interface StreamSource {
  url: string;
  isHls: boolean;
}

/** Handle returned by an attachment; `detach` releases engine resources. */
export interface MediaAttachment {
  detach(): void;
}

/**
 * Swappable port for wiring a stream to a video surface. The default engine
 * uses HLS.js when the surface can't play HLS natively; a fake engine in tests
 * records attachments and can simulate fatal errors — keeping HLS.js out of
 * the module's test path and local to one file.
 */
export interface MediaEngine {
  attach(surface: VideoSurface, source: StreamSource, onFatal: () => void): MediaAttachment;
}

const HLS_MIME = 'application/vnd.apple.mpegurl';

/** Default engine: HLS.js for HLS the surface can't play, native src otherwise. */
export class HlsMediaEngine implements MediaEngine {
  attach(surface: VideoSurface, source: StreamSource, onFatal: () => void): MediaAttachment {
    if (source.isHls && !surface.canPlayType(HLS_MIME)) {
      const hls = new Hls();
      hls.loadSource(source.url);
      hls.attachMedia(surface as unknown as HTMLMediaElement);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) onFatal();
      });
      return { detach: () => hls.destroy() };
    }
    surface.src = source.url;
    return { detach: () => undefined };
  }
}

export const MEDIA_ENGINE = new InjectionToken<MediaEngine>('MEDIA_ENGINE', {
  providedIn: 'root',
  factory: () => new HlsMediaEngine(),
});

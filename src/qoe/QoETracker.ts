export type QoEErrorType =
  | 'connection_fail'
  | 'media_play_fail'
  | 'network_error';

export interface QoESnapshot {
  playCount: number;
  errorCount: number;
  errorByType: Record<QoEErrorType, number>;
  initialPlayMs?: number;
  connectionMs?: number;
  bufferingCount: number;
  bufferingTotalMs: number;
  playbackTotalMs: number;
  bufferingRatio: number;
  sessionId?: string;
  lastUpdatedAt: number;
}

export interface QoEOptions {
  minReadyStateForPlaying?: number;
  onSnapshot?: (snapshot: QoESnapshot) => void;
}

export class QoETracker {
  private ctx: any;
  private player: any;
  private mediaElement: HTMLMediaElement | null = null;

  private playCount = 0;
  private errorByType: Record<QoEErrorType, number> = {
    connection_fail: 0,
    media_play_fail: 0,
    network_error: 0,
  };

  private firstSenderConnectedAt?: number;
  private firstLoadReceivedAt?: number;
  private firstPlayingAt?: number;

  private bufferingCount = 0;
  private bufferingStartedAt?: number;
  private bufferingTotalMs = 0;

  private playingStartedAt?: number;
  private playbackTotalMs = 0;

  private options: Required<QoEOptions> = {
    minReadyStateForPlaying: 2,
    onSnapshot: () => {},
  };

  constructor(ctx: any, opts?: QoEOptions) {
    this.ctx = ctx;
    this.player = ctx.getPlayerManager();
    if (opts) this.options = { ...this.options, ...opts };
  }

  init() {
    this.ctx.addEventListener((globalThis as any).cast.framework.system.EventType.SENDER_CONNECTED, this.onSenderConnected);
    this.ctx.addEventListener((globalThis as any).cast.framework.system.EventType.SENDER_DISCONNECTED, this.onSenderDisconnected);
    this.ctx.addEventListener((globalThis as any).cast.framework.system.EventType.READY, this.onReady);

    this.player.addEventListener((globalThis as any).cast.framework.events.EventType.LOAD_START, this.onLoadStart);
    this.player.addEventListener((globalThis as any).cast.framework.events.EventType.LOADED_DATA, this.onLoadedData);
    this.player.addEventListener((globalThis as any).cast.framework.events.EventType.PLAYING, this.onPlaying);
    this.player.addEventListener((globalThis as any).cast.framework.events.EventType.PAUSE, this.onPause);
    this.player.addEventListener((globalThis as any).cast.framework.events.EventType.BUFFERING, this.onBuffering);
    this.player.addEventListener((globalThis as any).cast.framework.events.EventType.ERROR, this.onPlayerError);

    try {
      const video = this.player?.getVideoElement?.();
      if (video) this.setMediaElement(video as HTMLVideoElement);
    } catch {}
  }

  dispose() {
    this.ctx.removeEventListener((globalThis as any).cast.framework.system.EventType.SENDER_CONNECTED, this.onSenderConnected);
    this.ctx.removeEventListener((globalThis as any).cast.framework.system.EventType.SENDER_DISCONNECTED, this.onSenderDisconnected);
    this.ctx.removeEventListener((globalThis as any).cast.framework.system.EventType.READY, this.onReady);

    this.player.removeEventListener((globalThis as any).cast.framework.events.EventType.LOAD_START, this.onLoadStart);
    this.player.removeEventListener((globalThis as any).cast.framework.events.EventType.LOADED_DATA, this.onLoadedData);
    this.player.removeEventListener((globalThis as any).cast.framework.events.EventType.PLAYING, this.onPlaying);
    this.player.removeEventListener((globalThis as any).cast.framework.events.EventType.PAUSE, this.onPause);
    this.player.removeEventListener((globalThis as any).cast.framework.events.EventType.BUFFERING, this.onBuffering);
    this.player.removeEventListener((globalThis as any).cast.framework.events.EventType.ERROR, this.onPlayerError);
  }

  setMediaElement(video: HTMLMediaElement) { this.mediaElement = video; }

  snapshot(): QoESnapshot {
    const sessionId = this.ctx?.getApplicationData?.()?.sessionId ?? undefined;
    const now = Date.now();

    if (this.playingStartedAt) {
      this.playbackTotalMs += now - this.playingStartedAt;
      this.playingStartedAt = now;
    }
    if (this.bufferingStartedAt) {
      this.bufferingTotalMs += now - this.bufferingStartedAt;
      this.bufferingStartedAt = now;
    }

    const initialPlayMs = (this.firstLoadReceivedAt && this.firstPlayingAt)
      ? Math.max(0, this.firstPlayingAt - this.firstLoadReceivedAt) : undefined;

    const connectionMs = (this.firstSenderConnectedAt && this.firstLoadReceivedAt)
      ? Math.max(0, this.firstLoadReceivedAt - this.firstSenderConnectedAt) : undefined;

    const errorCount = Object.values(this.errorByType).reduce((a,b)=>a+b,0);

    const shot: QoESnapshot = {
      playCount: this.playCount,
      errorCount,
      errorByType: { ...this.errorByType },
      initialPlayMs,
      connectionMs,
      bufferingCount: this.bufferingCount,
      bufferingTotalMs: this.bufferingTotalMs,
      playbackTotalMs: this.playbackTotalMs,
      bufferingRatio: this.playbackTotalMs > 0 ? this.bufferingTotalMs / this.playbackTotalMs : 0,
      sessionId,
      lastUpdatedAt: now,
    };
    this.options.onSnapshot?.(shot);
    return shot;
  }

  reset() {
    this.playCount = 0;
    this.errorByType = { connection_fail: 0, media_play_fail: 0, network_error: 0 };
    this.firstSenderConnectedAt = undefined;
    this.firstLoadReceivedAt = undefined;
    this.firstPlayingAt = undefined;
    this.bufferingCount = 0;
    this.bufferingStartedAt = undefined;
    this.bufferingTotalMs = 0;
    this.playingStartedAt = undefined;
    this.playbackTotalMs = 0;
  }

  private onSenderConnected = () => {
    if (this.firstSenderConnectedAt == null) this.firstSenderConnectedAt = Date.now();
  };
  private onSenderDisconnected = () => {};
  private onReady = () => {};

  private onLoadStart = () => {
    if (this.firstLoadReceivedAt == null) this.firstLoadReceivedAt = Date.now();
  };
  private onLoadedData = () => {};

  private onPlaying = () => {
    const now = Date.now();
    if (this.firstPlayingAt == null) this.firstPlayingAt = now;
    if (!this.playingStartedAt) this.playingStartedAt = now;
    if (this.bufferingStartedAt) {
      this.bufferingTotalMs += now - this.bufferingStartedAt;
      this.bufferingStartedAt = undefined;
    }
    if (this.mediaElement && this.mediaElement.readyState < this.options.minReadyStateForPlaying) {
      // optional: log
    }
    this.playCount += 1;
  };

  private onPause = () => {
    if (this.playingStartedAt) {
      const now = Date.now();
      this.playbackTotalMs += now - this.playingStartedAt;
      this.playingStartedAt = undefined;
    }
  };

  private onBuffering = (evt: any) => {
    const isBuffering = evt?.isBuffering ?? true;
    const now = Date.now();
    if (isBuffering) {
      if (this.playingStartedAt && !this.bufferingStartedAt) {
        this.bufferingStartedAt = now;
        this.bufferingCount += 1;
      }
    } else {
      if (this.bufferingStartedAt) {
        this.bufferingTotalMs += now - this.bufferingStartedAt;
        this.bufferingStartedAt = undefined;
      }
    }
  };

  private onPlayerError = (evt: any) => {
    const code = evt?.code ?? evt?.errorCode ?? evt?.error?.code ?? 'UNKNOWN';
    const s = String(code).toUpperCase();
    if (s.includes('SESSION') || s.includes('CHANNEL') || s.includes('RECEIVER_UNAVAILABLE')) {
      this.errorByType.connection_fail += 1;
    } else if (s.includes('NETWORK') || s.includes('HTTP') || s.includes('TIMEOUT')) {
      this.errorByType.network_error += 1;
    } else {
      this.errorByType.media_play_fail += 1;
    }
  };
}

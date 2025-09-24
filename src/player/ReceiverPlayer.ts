import { QoETracker } from "../qoe/QoETracker.js";
export class ReceiverPlayer {
  private context: any;
  private player: any;

  private qoe: QoETracker | null = null; 

  constructor() {
    const castAny: any = (globalThis as any).cast;
    this.context = castAny.framework.CastReceiverContext.getInstance();
    this.player = this.context.getPlayerManager();
    this.qoe = new QoETracker(this.context, { onSnapshot: (shot) => console.log('[QoE Snapshot]', shot) });
    try { const v = this.player?.getVideoElement?.(); if (v) this.qoe.setMediaElement(v as HTMLVideoElement); } catch {}
  }

  private guessContentType(url: string): string {
    const u = url.toLowerCase();
    if (u.endsWith('.m3u8')) return 'application/x-mpegURL';
    if (u.endsWith('.mpd')) return 'application/dash+xml';
    if (u.endsWith('.mp4')) return 'video/mp4';
    return 'video/mp4';
  }

  init() {
    this.qoe?.init();
    this.player.setMessageInterceptor(
      (globalThis as any).cast.framework.messages.MessageType.LOAD,
      (req: any) => {
        try {
          if (req.media && !req.media.contentType) {
            req.media.contentType = this.guessContentType(req.media.url);
          }
          if (req.autoplay !== false) req.autoplay = true;
          console.log("[Receiver] LOAD", req.media?.contentId);
        } catch (e) {
          console.warn("[Receiver] LOAD interceptor error", e);
        }
        return req;
      }
    );

    const qoe_ns = "urn:x-cast:app.events";  
    this.player.addEventListener(
      (globalThis as any).cast.framework.events.EventType.ERROR,
      (e: any) => {
        try {
          const msg = e?.error?.reason || e?.code || "Playback error";
          this.context.sendBroadcastMessage(
            qoe_ns,
            JSON.stringify({ type: "ERROR", message: msg })
          );
          console.log("[Receiver] Error", msg, e);
        } catch (err) {
          console.warn("[Receiver] Error interceptor failed", err);
        }
      });

    const ns = "urn:x-cast:app.control";
    this.context.addCustomMessageListener(ns, (event: any) => {
      try {
        const data = event.data || {};
        if (data.type === "PLAYBACK_RATE" && typeof data.rate === "number") {
          if (this.player.setPlaybackRate) {
            this.player.setPlaybackRate(data.rate);
            console.log("[Receiver] playbackRate set to", data.rate);
          } else {
            console.log("[Receiver] setPlaybackRate not available in this environment");
          }
        }
      } catch (e) {
        console.warn("[Receiver] custom message error", e);
      }
    });
  }

  start() {
    this.context.start();
  }
}

import { APP_CONFIG } from "./config.js";

export const YOUTUBE_PLAYER_STATES = Object.freeze({
  unstarted: -1,
  ended: 0,
  playing: 1,
  paused: 2,
  buffering: 3,
  cued: 5,
});

export function youtubeStateToStatus(state) {
  switch (state) {
    case YOUTUBE_PLAYER_STATES.playing: return "playing";
    case YOUTUBE_PLAYER_STATES.paused: return "paused";
    case YOUTUBE_PLAYER_STATES.buffering: return "loading";
    case YOUTUBE_PLAYER_STATES.ended: return "ended";
    case YOUTUBE_PLAYER_STATES.cued: return "ready";
    default: return "loading";
  }
}

let apiPromise;

export function shouldRecoverYouTubeLive({ state, stateSince, lastProgressAt, now, isLive }) {
  if (!isLive) return false;
  if (state === YOUTUBE_PLAYER_STATES.paused) {
    return now - stateSince >= APP_CONFIG.youtubePauseRecoveryMs;
  }
  if ([
    YOUTUBE_PLAYER_STATES.unstarted,
    YOUTUBE_PLAYER_STATES.ended,
    YOUTUBE_PLAYER_STATES.buffering,
  ].includes(state)) {
    return now - stateSince >= APP_CONFIG.youtubeStallRecoveryMs;
  }
  return state === YOUTUBE_PLAYER_STATES.playing
    && now - lastProgressAt >= APP_CONFIG.youtubeStallRecoveryMs;
}

function loadYouTubeApi() {
  if (globalThis.YT?.Player) return Promise.resolve(globalThis.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve, reject) => {
    const previousReady = globalThis.onYouTubeIframeAPIReady;
    globalThis.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve(globalThis.YT);
    };

    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (existing) return;
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.addEventListener("error", () => reject(new Error("YouTube IFrame API failed to load")), { once: true });
    document.head.append(script);
  });
  return apiPromise;
}

function isLivePlayer(player) {
  try {
    return player.getVideoData?.().isLive === true;
  } catch {
    return false;
  }
}

export function keepYouTubeLivePlaying(frame, videoId, { onStatus = () => {} } = {}) {
  let disposed = false;
  let player;
  let healthTimer;
  let state = YOUTUBE_PLAYER_STATES.unstarted;
  let stateSince = Date.now();
  let lastProgressAt = stateSince;
  let lastTime = -1;
  let desiredMuted = true;

  function recover() {
    if (!player || document.hidden) return;
    try {
      onStatus("loading");
      if (state === YOUTUBE_PLAYER_STATES.ended) player.loadVideoById(videoId);
      else {
        const duration = player.getDuration?.();
        if (state === YOUTUBE_PLAYER_STATES.buffering && Number.isFinite(duration) && duration > 1) {
          player.seekTo(duration - 1, true);
        }
        player.playVideo();
      }
      stateSince = Date.now();
      lastProgressAt = stateSince;
    } catch {
      // The next health check retries while the embed is available.
    }
  }

  loadYouTubeApi().then((YT) => {
    if (disposed || !frame.isConnected) return;
    player = new YT.Player(frame, {
      events: {
        onReady(event) {
          if (disposed) return;
          if (desiredMuted) event.target.mute();
          else event.target.unMute();
          event.target.playVideo();
          healthTimer = window.setInterval(() => {
            if (!player || document.hidden) return;
            const now = Date.now();
            try {
              const currentTime = player.getCurrentTime?.() ?? -1;
              if (state === YOUTUBE_PLAYER_STATES.playing && currentTime > lastTime + 0.1) {
                lastProgressAt = now;
              }
              lastTime = currentTime;
            } catch {
              return;
            }
            if (shouldRecoverYouTubeLive({
              state,
              stateSince,
              lastProgressAt,
              now,
              isLive: isLivePlayer(player),
            })) recover();
          }, APP_CONFIG.youtubeHealthCheckMs);
        },
        onStateChange(event) {
          state = event.data;
          stateSince = Date.now();
          if (state === YOUTUBE_PLAYER_STATES.playing) lastProgressAt = stateSince;
          onStatus(youtubeStateToStatus(state));
        },
        onError() {
          onStatus("error");
        },
      },
    });
  }).catch(() => {
    onStatus("unknown");
    // Playback remains available even when the optional recovery API cannot load.
  });

  return {
    setMuted(muted) {
      desiredMuted = Boolean(muted);
      try {
        if (desiredMuted) player?.mute();
        else player?.unMute();
      } catch {
        // The desired state is applied again when the player becomes ready.
      }
    },
    dispose() {
      disposed = true;
      window.clearInterval(healthTimer);
      try {
        player?.destroy();
      } catch {
        // The iframe may already have been removed.
      }
    },
  };
}

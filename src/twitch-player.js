import { buildPlayerUrl } from "./providers.js";

let apiPromise;

function loadTwitchApi() {
  if (globalThis.Twitch?.Player) return Promise.resolve(globalThis.Twitch);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://player.twitch.tv/js/embed/v1.js"]');
    const finish = () => globalThis.Twitch?.Player
      ? resolve(globalThis.Twitch)
      : reject(new Error("Twitch Player API unavailable"));
    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://player.twitch.tv/js/embed/v1.js";
    script.async = true;
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", reject, { once: true });
    document.head.append(script);
  });
  return apiPromise;
}

function appendFallback(host, stream, hostname, onStatus) {
  const frame = document.createElement("iframe");
  frame.className = "stream-frame";
  frame.title = `${stream.label}の配信画面`;
  frame.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media";
  frame.allowFullscreen = true;
  frame.referrerPolicy = "strict-origin-when-cross-origin";
  frame.addEventListener("load", () => onStatus("unknown"), { once: true });
  frame.src = buildPlayerUrl(stream, hostname);
  host.replaceChildren(frame);
}

export function createTwitchPlayerController(host, stream, hostname, { onStatus = () => {} } = {}) {
  let disposed = false;
  let player;
  let desiredMuted = true;

  loadTwitchApi().then((Twitch) => {
    if (disposed || !host.isConnected) return;
    if (!host.id) host.id = `twitch-player-${stream.id.replace(/[^A-Za-z0-9_-]/g, "")}`;
    player = new Twitch.Player(host.id, {
      channel: stream.sourceId,
      parent: [hostname || "localhost"],
      autoplay: true,
      muted: true,
      width: "100%",
      height: "100%",
    });

    const listen = (eventName, status) => {
      if (!eventName) return;
      player.addEventListener(eventName, () => {
        if (!disposed) onStatus(status);
      });
    };
    listen(Twitch.Player.PLAY, "playing");
    listen(Twitch.Player.PLAYING, "playing");
    listen(Twitch.Player.PAUSE, "paused");
    listen(Twitch.Player.ENDED, "ended");
    listen(Twitch.Player.OFFLINE, "offline");
    listen(Twitch.Player.ONLINE, "loading");
    listen(Twitch.Player.PLAYBACK_BLOCKED, "error");
    player.addEventListener(Twitch.Player.READY, () => {
      if (disposed) return;
      player.setMuted(desiredMuted);
      onStatus("ready");
    });
  }).catch(() => {
    if (!disposed) appendFallback(host, stream, hostname, onStatus);
  });

  return {
    getMuted() {
      try {
        return player?.getMuted?.() ?? desiredMuted;
      } catch {
        return desiredMuted;
      }
    },
    setMuted(muted) {
      desiredMuted = Boolean(muted);
      try {
        player?.setMuted(desiredMuted);
      } catch {
        // The desired state is applied when the player becomes ready.
      }
    },
    dispose() {
      disposed = true;
      host.replaceChildren();
    },
  };
}

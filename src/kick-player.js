import { buildPlayerUrl } from "./providers.js";

export function createKickPlayerController(host, stream, { onStatus = () => {} } = {}) {
  const frame = document.createElement("iframe");
  frame.className = "stream-frame";
  frame.title = `${stream.label}の配信画面`;
  frame.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media";
  frame.allowFullscreen = true;
  frame.referrerPolicy = "strict-origin-when-cross-origin";
  frame.addEventListener("load", () => onStatus("ready"), { once: true });
  frame.src = buildPlayerUrl(stream, location.hostname, location.origin);
  host.replaceChildren(frame);

  return {
    getMuted: () => true,
    setMuted() {
      // KICK does not expose an official runtime audio-control API.
    },
    dispose() {
      frame.remove();
    },
  };
}

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const TWITCH_CHANNEL_PATTERN = /^[A-Za-z0-9_]{3,25}$/;
const TWITCH_RESERVED_PATHS = new Set([
  "directory",
  "downloads",
  "jobs",
  "p",
  "search",
  "settings",
  "videos",
]);

export class StreamInputError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "StreamInputError";
    this.code = code;
  }
}

function parseUrlCandidate(value) {
  try {
    return new URL(value);
  } catch {
    try {
      return new URL(`https://${value}`);
    } catch {
      return null;
    }
  }
}

function parseYouTubeUrl(url) {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  let videoId = "";

  if (host === "youtu.be") {
    videoId = url.pathname.split("/").filter(Boolean)[0] ?? "";
  } else if (host === "youtube.com" || host === "m.youtube.com") {
    const segments = url.pathname.split("/").filter(Boolean);
    if (url.pathname === "/watch") videoId = url.searchParams.get("v") ?? "";
    if (["live", "shorts", "embed"].includes(segments[0])) videoId = segments[1] ?? "";
  } else {
    return null;
  }

  if (!YOUTUBE_ID_PATTERN.test(videoId)) {
    throw new StreamInputError(
      "youtube-id",
      "YouTube動画IDを確認できませんでした。watch、live、shortsの動画URLを入力してください。",
    );
  }

  return {
    provider: "youtube",
    sourceId: videoId,
    label: `YouTube ${videoId}`,
    canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

function parseTwitchUrl(url) {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host !== "twitch.tv" && host !== "m.twitch.tv") return null;

  const channel = (url.pathname.split("/").filter(Boolean)[0] ?? "").toLowerCase();
  if (!TWITCH_CHANNEL_PATTERN.test(channel) || TWITCH_RESERVED_PATHS.has(channel)) {
    throw new StreamInputError(
      "twitch-channel",
      "Twitchチャンネルを確認できませんでした。チャンネルページのURLを入力してください。",
    );
  }

  return {
    provider: "twitch",
    sourceId: channel,
    label: channel,
    canonicalUrl: `https://www.twitch.tv/${channel}`,
  };
}

export function parseStreamInput(rawInput) {
  const value = String(rawInput ?? "").trim();
  if (!value) {
    throw new StreamInputError("empty", "配信先が空です。チャンネル名またはURLを入力してください。");
  }

  const prefixedYouTube = value.match(/^(?:yt|youtube):(.+)$/i);
  if (prefixedYouTube) {
    const videoId = prefixedYouTube[1].trim();
    if (!YOUTUBE_ID_PATTERN.test(videoId)) {
      throw new StreamInputError("youtube-id", "YouTube動画IDは11文字です。IDを確認してください。");
    }
    return {
      provider: "youtube",
      sourceId: videoId,
      label: `YouTube ${videoId}`,
      canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    };
  }

  const prefixedTwitch = value.match(/^twitch:(.+)$/i);
  const bareTwitch = prefixedTwitch ? prefixedTwitch[1].trim() : value;
  if (TWITCH_CHANNEL_PATTERN.test(bareTwitch) && !bareTwitch.includes(".")) {
    const channel = bareTwitch.toLowerCase();
    if (TWITCH_RESERVED_PATHS.has(channel)) {
      throw new StreamInputError("twitch-channel", "Twitchの予約ページ名はチャンネルとして追加できません。");
    }
    return {
      provider: "twitch",
      sourceId: channel,
      label: channel,
      canonicalUrl: `https://www.twitch.tv/${channel}`,
    };
  }

  const url = parseUrlCandidate(value);
  if (!url) {
    throw new StreamInputError("invalid-url", "URLを読み取れませんでした。TwitchまたはYouTubeのURLを入力してください。");
  }

  const parsed = parseYouTubeUrl(url) ?? parseTwitchUrl(url);
  if (!parsed) {
    throw new StreamInputError("unsupported", "TwitchまたはYouTubeの配信URLだけを追加できます。");
  }
  return parsed;
}

function embedHost(hostname) {
  const value = String(hostname ?? "").trim().toLowerCase();
  return value || "localhost";
}

export function buildPlayerUrl(stream, hostname, origin = "") {
  if (stream.provider === "twitch") {
    const params = new URLSearchParams({
      channel: stream.sourceId,
      parent: embedHost(hostname),
      autoplay: "true",
      muted: "true",
    });
    return `https://player.twitch.tv/?${params}`;
  }

  if (stream.provider === "youtube") {
    const params = new URLSearchParams({
      autoplay: "1",
      mute: "1",
      playsinline: "1",
      rel: "0",
      enablejsapi: "1",
    });
    if (/^https?:\/\//i.test(origin)) params.set("origin", origin);
    return `https://www.youtube-nocookie.com/embed/${stream.sourceId}?${params}`;
  }

  throw new StreamInputError("provider", "未対応の配信サービスです。");
}

export function buildChatUrl(stream, hostname) {
  const parent = embedHost(hostname);
  if (stream.provider === "twitch") {
    const params = new URLSearchParams({ parent, darkpopout: "" });
    return `https://www.twitch.tv/embed/${stream.sourceId}/chat?${params}`;
  }

  if (stream.provider === "youtube") {
    const params = new URLSearchParams({
      v: stream.sourceId,
      embed_domain: parent,
      dark_theme: "1",
    });
    return `https://www.youtube.com/live_chat?${params}`;
  }

  throw new StreamInputError("provider", "未対応の配信サービスです。");
}

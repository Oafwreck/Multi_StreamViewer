import test from "node:test";
import assert from "node:assert/strict";
import { buildChatUrl, buildPlayerUrl, parseStreamInput, StreamInputError } from "../src/providers.js";

test("Twitch channel names and URLs are normalized", () => {
  assert.deepEqual(parseStreamInput("Twitch:Shroud"), {
    provider: "twitch",
    sourceId: "shroud",
    label: "shroud",
    canonicalUrl: "https://www.twitch.tv/shroud",
  });
  assert.equal(parseStreamInput("https://www.twitch.tv/Ninja").sourceId, "ninja");
});

test("YouTube watch, live, short URLs and yt prefix are supported", () => {
  const id = "dQw4w9WgXcQ";
  assert.equal(parseStreamInput(`https://youtube.com/watch?v=${id}`).sourceId, id);
  assert.equal(parseStreamInput(`https://youtube.com/live/${id}`).sourceId, id);
  assert.equal(parseStreamInput(`https://youtu.be/${id}`).sourceId, id);
  assert.equal(parseStreamInput(`yt:${id}`).provider, "youtube");
});

test("Unsupported and malformed inputs return actionable errors", () => {
  assert.throws(() => parseStreamInput(""), StreamInputError);
  assert.throws(() => parseStreamInput("https://example.com/live"), /TwitchまたはYouTube/);
  assert.throws(() => parseStreamInput("yt:short"), /11文字/);
});

test("Embed URLs include the current host where required", () => {
  const twitch = parseStreamInput("twitch:shroud");
  const youtube = parseStreamInput("yt:dQw4w9WgXcQ");
  assert.match(buildPlayerUrl(twitch, "localhost"), /parent=localhost/);
  assert.match(buildChatUrl(twitch, "localhost"), /parent=localhost/);
  const youtubeChatUrl = buildChatUrl(youtube, "example.test");
  assert.match(youtubeChatUrl, /embed_domain=example.test/);
  assert.match(youtubeChatUrl, /dark_theme=1/);
  assert.match(buildPlayerUrl(youtube, "localhost"), /youtube-nocookie\.com/);
});

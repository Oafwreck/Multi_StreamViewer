export const APP_CONFIG = Object.freeze({
  maxStreams: 8,
  storageKey: "multiview-desk.state.v1",
  embedLoadWarningMs: 12_000,
  undoDurationMs: 7_000,
  youtubeHealthCheckMs: 5_000,
  youtubeStallRecoveryMs: 20_000,
  youtubePauseRecoveryMs: 60_000,
  serverPort: 4173,
});

export const PROVIDER_LABELS = Object.freeze({
  twitch: "Twitch",
  youtube: "YouTube",
  kick: "KICK",
});

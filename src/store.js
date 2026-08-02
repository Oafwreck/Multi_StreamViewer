import { APP_CONFIG } from "./config.js";

export const DEFAULT_STATE = Object.freeze({
  streams: [],
  selectedId: null,
  chatOpen: true,
  layoutMode: "equal",
  audioFocus: false,
});

function sameSource(a, b) {
  return a.provider === b.provider && a.sourceId === b.sourceId;
}

export function reduceState(state, action) {
  switch (action.type) {
    case "ADD_STREAM": {
      if (state.streams.length >= APP_CONFIG.maxStreams) return state;
      if (state.streams.some((stream) => sameSource(stream, action.stream))) return state;
      const streams = [...state.streams, action.stream];
      return { ...state, streams, selectedId: state.selectedId ?? action.stream.id };
    }
    case "REMOVE_STREAM": {
      const index = state.streams.findIndex((stream) => stream.id === action.id);
      if (index < 0) return state;
      const streams = state.streams.filter((stream) => stream.id !== action.id);
      const selectedId = state.selectedId === action.id
        ? (streams[Math.min(index, streams.length - 1)]?.id ?? null)
        : state.selectedId;
      return { ...state, streams, selectedId };
    }
    case "RESTORE_STREAM": {
      if (state.streams.length >= APP_CONFIG.maxStreams) return state;
      if (state.streams.some((stream) => stream.id === action.stream.id || sameSource(stream, action.stream))) return state;
      const streams = [...state.streams];
      streams.splice(Math.min(action.index, streams.length), 0, action.stream);
      return { ...state, streams, selectedId: action.select ? action.stream.id : state.selectedId };
    }
    case "SELECT_STREAM":
      return state.streams.some((stream) => stream.id === action.id) && state.selectedId !== action.id
        ? { ...state, selectedId: action.id }
        : state;
    case "MOVE_STREAM": {
      const sourceIndex = state.streams.findIndex((stream) => stream.id === action.id);
      if (sourceIndex < 0 || action.id === action.targetId) return state;
      const streams = [...state.streams];
      const [moved] = streams.splice(sourceIndex, 1);
      const targetIndex = streams.findIndex((stream) => stream.id === action.targetId);
      if (targetIndex < 0) return state;
      const insertIndex = targetIndex + (action.position === "after" ? 1 : 0);
      streams.splice(insertIndex, 0, moved);
      if (streams.every((stream, index) => stream === state.streams[index])) return state;
      return { ...state, streams };
    }
    case "TOGGLE_LAYOUT":
      return { ...state, layoutMode: state.layoutMode === "focus" ? "equal" : "focus" };
    case "TOGGLE_AUDIO_FOCUS":
      return { ...state, audioFocus: !state.audioFocus };
    case "TOGGLE_CHAT":
      return { ...state, chatOpen: !state.chatOpen };
    default:
      return state;
  }
}

export function hydrateState(value) {
  if (!value || !Array.isArray(value.streams)) return { ...DEFAULT_STATE };
  const streams = value.streams
    .filter((stream) => stream && ["twitch", "youtube"].includes(stream.provider))
    .filter((stream) => typeof stream.id === "string" && typeof stream.sourceId === "string")
    .slice(0, APP_CONFIG.maxStreams);
  const selectedId = streams.some((stream) => stream.id === value.selectedId)
    ? value.selectedId
    : (streams[0]?.id ?? null);
  const layoutMode = value.layoutMode === "focus" ? "focus" : "equal";
  return {
    streams,
    selectedId,
    chatOpen: value.chatOpen !== false,
    layoutMode,
    audioFocus: value.audioFocus === true,
  };
}

export function createStore({ storage = globalThis.localStorage } = {}) {
  let state = { ...DEFAULT_STATE };
  const listeners = new Set();

  try {
    const saved = storage?.getItem(APP_CONFIG.storageKey);
    if (saved) state = hydrateState(JSON.parse(saved));
  } catch {
    state = { ...DEFAULT_STATE };
  }

  function persist() {
    try {
      storage?.setItem(APP_CONFIG.storageKey, JSON.stringify(state));
    } catch {
      // The app remains usable when storage is unavailable.
    }
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispatch(action) {
      const next = reduceState(state, action);
      if (next === state) return false;
      state = next;
      persist();
      listeners.forEach((listener) => listener(state, action));
      return true;
    },
  };
}

import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_STATE, hydrateState, reduceState } from "../src/store.js";

function stream(index, provider = "twitch") {
  return {
    id: `id-${index}`,
    provider,
    sourceId: `source-${index}`,
    label: `Stream ${index}`,
    canonicalUrl: `https://example.test/${index}`,
  };
}

test("The first added stream becomes selected", () => {
  const next = reduceState({ ...DEFAULT_STATE }, { type: "ADD_STREAM", stream: stream(1) });
  assert.equal(next.streams.length, 1);
  assert.equal(next.selectedId, "id-1");
});

test("Duplicate sources and a ninth stream are rejected", () => {
  let state = { ...DEFAULT_STATE };
  for (let index = 0; index < 8; index += 1) {
    state = reduceState(state, { type: "ADD_STREAM", stream: stream(index) });
  }
  const fullState = state;
  state = reduceState(state, { type: "ADD_STREAM", stream: stream(8) });
  assert.equal(state, fullState);
  state = reduceState(state, { type: "ADD_STREAM", stream: { ...stream(0), id: "other" } });
  assert.equal(state, fullState);
});

test("Removing a selected stream selects the nearest remaining stream", () => {
  const streams = [stream(1), stream(2), stream(3)];
  const state = { streams, selectedId: "id-2", chatOpen: true };
  const next = reduceState(state, { type: "REMOVE_STREAM", id: "id-2" });
  assert.deepEqual(next.streams.map((item) => item.id), ["id-1", "id-3"]);
  assert.equal(next.selectedId, "id-3");
});

test("A removed stream can be restored at its prior index", () => {
  const state = { streams: [stream(1), stream(3)], selectedId: "id-1", chatOpen: true };
  const next = reduceState(state, { type: "RESTORE_STREAM", stream: stream(2), index: 1, select: true });
  assert.deepEqual(next.streams.map((item) => item.id), ["id-1", "id-2", "id-3"]);
  assert.equal(next.selectedId, "id-2");
});

test("Hydration removes invalid excess state", () => {
  const streams = Array.from({ length: 10 }, (_, index) => stream(index));
  streams.push({ id: 12, provider: "unknown" });
  const state = hydrateState({ streams, selectedId: "missing", chatOpen: false });
  assert.equal(state.streams.length, 8);
  assert.equal(state.selectedId, "id-0");
  assert.equal(state.chatOpen, false);
});


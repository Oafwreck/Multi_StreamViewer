import { APP_CONFIG } from "./config.js";
import { parseStreamInput } from "./providers.js";
import { createStore } from "./store.js";
import { createRenderer } from "./ui.js";

const store = createStore();
const form = document.querySelector("#add-form");
const input = document.querySelector("#stream-input");
const helper = document.querySelector("#stream-helper");
const addButton = document.querySelector("#add-button");
const chatToggle = document.querySelector("#chat-toggle");
const toast = document.querySelector("#toast");
const toastMessage = document.querySelector("#toast-message");
const toastAction = document.querySelector("#toast-action");
let undoRecord = null;
let undoTimer = null;

function setFormError(message = "") {
  const hasError = Boolean(message);
  input.setAttribute("aria-invalid", String(hasError));
  helper.classList.toggle("is-error", hasError);
  helper.textContent = message || "YouTube動画IDは「yt:VIDEO_ID」でも追加できます。";
  addButton.dataset.state = hasError ? "error" : "default";
}

function makeStream(parsed) {
  const id = globalThis.crypto?.randomUUID?.()
    ?? `${parsed.provider}-${parsed.sourceId}-${Date.now()}`;
  return { ...parsed, id };
}

function showUndo(stream, index, wasSelected) {
  undoRecord = { stream, index, wasSelected };
  toastMessage.textContent = `${stream.label}を削除しました。`;
  toast.hidden = false;
  window.clearTimeout(undoTimer);
  undoTimer = window.setTimeout(() => {
    toast.hidden = true;
    undoRecord = null;
  }, APP_CONFIG.undoDurationMs);
}

const render = createRenderer({
  onSelect(id) {
    store.dispatch({ type: "SELECT_STREAM", id });
  },
  onRemove(id) {
    const state = store.getState();
    const index = state.streams.findIndex((stream) => stream.id === id);
    const stream = state.streams[index];
    if (!stream) return;
    const wasSelected = state.selectedId === id;
    store.dispatch({ type: "REMOVE_STREAM", id });
    showUndo(stream, index, wasSelected);
  },
});

store.subscribe(render);
render(store.getState());

form.addEventListener("submit", (event) => {
  event.preventDefault();
  setFormError();
  const state = store.getState();
  if (state.streams.length >= APP_CONFIG.maxStreams) {
    setFormError("8画面が上限です。不要な配信を削除してから追加してください。");
    return;
  }

  try {
    const parsed = parseStreamInput(input.value);
    const duplicate = state.streams.some(
      (stream) => stream.provider === parsed.provider && stream.sourceId === parsed.sourceId,
    );
    if (duplicate) {
      setFormError("その配信はすでに表示中です。別の配信を入力してください。");
      return;
    }
    store.dispatch({ type: "ADD_STREAM", stream: makeStream(parsed) });
    input.value = "";
    input.focus();
  } catch (error) {
    setFormError(error instanceof Error ? error.message : "配信を追加できませんでした。入力を確認してください。");
  }
});

input.addEventListener("blur", () => {
  if (!input.value.trim()) return;
  try {
    parseStreamInput(input.value);
    setFormError();
  } catch (error) {
    setFormError(error.message);
  }
});

input.addEventListener("input", () => {
  if (input.getAttribute("aria-invalid") === "true") setFormError();
});

chatToggle.addEventListener("click", () => store.dispatch({ type: "TOGGLE_CHAT" }));
document.querySelector("#focus-input").addEventListener("click", () => input.focus());

toastAction.addEventListener("click", () => {
  if (!undoRecord) return;
  store.dispatch({
    type: "RESTORE_STREAM",
    stream: undoRecord.stream,
    index: undoRecord.index,
    select: undoRecord.wasSelected,
  });
  window.clearTimeout(undoTimer);
  toast.hidden = true;
  undoRecord = null;
});

if (location.protocol === "file:") {
  document.querySelector("#protocol-warning").hidden = false;
}


import { APP_CONFIG, PROVIDER_LABELS } from "./config.js";
import { resolveRestoredMute } from "./audio-focus.js";
import { buildChatUrl, buildPlayerUrl } from "./providers.js";
import { createTwitchPlayerController } from "./twitch-player.js";
import { keepYouTubeLivePlaying } from "./youtube-player.js";

const STATUS_LABELS = Object.freeze({
  loading: "読み込み中",
  reconnecting: "再接続中",
  ready: "準備完了",
  playing: "再生中",
  paused: "一時停止",
  offline: "オフライン",
  ended: "終了",
  error: "エラー",
  unknown: "状態不明",
});

export function createRenderer({ onSelect, onRemove, onReorder }) {
  const elements = {
    count: document.querySelector("#stream-count"),
    empty: document.querySelector("#empty-state"),
    grid: document.querySelector("#stream-grid"),
    selection: document.querySelector("#selection-label"),
    chatPanel: document.querySelector("#chat-panel"),
    chatTitle: document.querySelector("#chat-title"),
    chatProvider: document.querySelector("#chat-provider"),
    chatSlot: document.querySelector("#chat-slot"),
    chatToggle: document.querySelector("#chat-toggle"),
    layoutToggle: document.querySelector("#layout-toggle"),
    audioToggle: document.querySelector("#audio-toggle"),
    template: document.querySelector("#stream-card-template"),
  };
  const cards = new Map();
  let renderedChatKey = null;
  let orderedIds = [];
  let draggedId = null;
  let previousAudioFocus = false;

  function clearDragState() {
    cards.forEach((card) => card.classList.remove("is-dragging", "is-drop-target"));
    draggedId = null;
  }

  function loadFrame(card, stream) {
    const host = card.querySelector(".stream-player");
    const loading = card.querySelector(".embed-loading");
    const status = card.querySelector(".stream-card__status");

    const updateStatus = (nextStatus) => {
      const safeStatus = STATUS_LABELS[nextStatus] ? nextStatus : "unknown";
      status.dataset.state = safeStatus;
      status.textContent = STATUS_LABELS[safeStatus];
      if (!["loading", "reconnecting"].includes(safeStatus)) {
        card.hasLoaded = true;
        window.clearTimeout(card.loadWarningTimer);
        loading.hidden = true;
      } else if (!card.hasLoaded) {
        loading.hidden = false;
      }
    };

    window.clearTimeout(card.loadWarningTimer);
    card.playerController?.dispose();
    host.replaceChildren();
    card.hasLoaded = false;
    loading.hidden = false;
    loading.textContent = "配信を読み込み中";
    updateStatus("loading");
    card.loadWarningTimer = window.setTimeout(() => {
      if (!loading.hidden) loading.textContent = "読み込みが続いています。配信側の埋め込み設定も確認してください。";
    }, APP_CONFIG.embedLoadWarningMs);

    if (stream.provider === "twitch") {
      card.playerController = createTwitchPlayerController(
        host,
        stream,
        location.hostname,
        { onStatus: updateStatus },
      );
      card.playerController.setMuted(card.shouldBeMuted ?? true);
      return;
    }

    const frame = document.createElement("iframe");
    frame.className = "stream-frame";
    frame.title = `${stream.label}の配信画面`;
    frame.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media";
    frame.allowFullscreen = true;
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.addEventListener("load", () => updateStatus("ready"), { once: true });
    frame.src = buildPlayerUrl(stream, location.hostname, location.origin);
    host.append(frame);
    card.playerController = keepYouTubeLivePlaying(frame, stream.sourceId, { onStatus: updateStatus });
    card.playerController.setMuted(card.shouldBeMuted ?? true);
  }

  function createCard(stream) {
    const card = elements.template.content.firstElementChild.cloneNode(true);
    const selectButton = card.querySelector(".stream-card__select");
    const dragButton = card.querySelector(".stream-card__drag");
    const reloadButton = card.querySelector(".stream-card__reload");
    const removeButton = card.querySelector(".stream-card__remove");

    card.dataset.streamId = stream.id;
    card.querySelector(".stream-card__name").textContent = stream.label;
    card.querySelector(".stream-card__provider").textContent = PROVIDER_LABELS[stream.provider];
    selectButton.setAttribute("aria-label", `${stream.label}のチャットを表示`);
    dragButton.setAttribute("aria-label", `${stream.label}を並び替え`);
    reloadButton.setAttribute("aria-label", `${stream.label}を再読み込み`);
    removeButton.setAttribute("aria-label", `${stream.label}を削除`);
    selectButton.addEventListener("click", () => onSelect(stream.id));
    reloadButton.addEventListener("click", () => loadFrame(card, stream));
    removeButton.addEventListener("click", () => onRemove(stream.id));
    dragButton.addEventListener("dragstart", (event) => {
      draggedId = stream.id;
      card.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", stream.id);
    });
    dragButton.addEventListener("dragend", clearDragState);
    dragButton.addEventListener("keydown", (event) => {
      if (!["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"].includes(event.key)) return;
      const index = orderedIds.indexOf(stream.id);
      const delta = ["ArrowUp", "ArrowLeft"].includes(event.key) ? -1 : 1;
      const targetId = orderedIds[index + delta];
      if (!targetId) return;
      event.preventDefault();
      onReorder(stream.id, targetId, delta < 0 ? "before" : "after");
    });
    card.addEventListener("dragover", (event) => {
      if (!draggedId || draggedId === stream.id) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      cards.forEach((item) => {
        if (item !== card) item.classList.remove("is-drop-target");
      });
      card.classList.add("is-drop-target");
    });
    card.addEventListener("dragleave", () => card.classList.remove("is-drop-target"));
    card.addEventListener("drop", (event) => {
      if (!draggedId || draggedId === stream.id) return;
      event.preventDefault();
      const bounds = card.getBoundingClientRect();
      const position = event.clientY < bounds.top + (bounds.height / 2) ? "before" : "after";
      onReorder(draggedId, stream.id, position);
      clearDragState();
    });
    loadFrame(card, stream);
    return card;
  }

  function syncCards(state) {
    const liveIds = new Set(state.streams.map((stream) => stream.id));
    cards.forEach((card, id) => {
      if (!liveIds.has(id)) {
        window.clearTimeout(card.loadWarningTimer);
        card.playerController?.dispose();
        card.remove();
        cards.delete(id);
      }
    });

    orderedIds = state.streams.map((stream) => stream.id);
    state.streams.forEach((stream, index) => {
      if (!cards.has(stream.id)) {
        const card = createCard(stream);
        cards.set(stream.id, card);
        elements.grid.append(card);
      }
      const card = cards.get(stream.id);
      const selected = stream.id === state.selectedId;
      card.classList.toggle("is-selected", selected);
      card.classList.toggle("is-focused", selected && state.layoutMode === "focus");
      card.style.setProperty("--stream-order", String(index));
      card.querySelector(".stream-card__select").setAttribute("aria-pressed", String(selected));
    });
  }

  function syncAudio(state) {
    if (state.audioFocus) {
      if (!previousAudioFocus) {
        cards.forEach((card) => {
          card.mutedBeforeAudioFocus = card.playerController?.getMuted?.() ?? true;
        });
      }
      cards.forEach((card, id) => {
        card.shouldBeMuted = id !== state.selectedId;
        card.playerController?.setMuted(card.shouldBeMuted);
      });
    } else if (previousAudioFocus) {
      cards.forEach((card, id) => {
        card.shouldBeMuted = resolveRestoredMute(
          card.mutedBeforeAudioFocus,
          id === state.selectedId,
        );
        card.playerController?.setMuted(card.shouldBeMuted);
        delete card.mutedBeforeAudioFocus;
      });
    }
    previousAudioFocus = state.audioFocus;
  }

  function renderChat(state) {
    const selected = state.streams.find((stream) => stream.id === state.selectedId) ?? null;
    const nextKey = selected ? `${selected.provider}:${selected.sourceId}` : null;
    if (renderedChatKey === nextKey) return;
    renderedChatKey = nextKey;
    elements.chatSlot.replaceChildren();

    if (!selected) {
      const empty = document.createElement("div");
      empty.className = "chat-empty";
      empty.textContent = "画面上部の配信名を押すと、その配信のチャットを表示します。";
      elements.chatSlot.append(empty);
      elements.chatTitle.textContent = "チャットを選択";
      elements.chatProvider.textContent = "—";
      return;
    }

    elements.chatTitle.textContent = selected.label;
    elements.chatProvider.textContent = PROVIDER_LABELS[selected.provider];

    if (selected.provider === "youtube") {
      const note = document.createElement("p");
      note.className = "chat-note";
      note.textContent = "YouTubeチャットはライブ配信でのみ表示されます。";
      elements.chatSlot.append(note);
    }

    const loading = document.createElement("div");
    loading.className = "embed-loading";
    loading.textContent = "チャットを読み込み中";
    const frame = document.createElement("iframe");
    frame.className = "chat-frame";
    frame.title = `${selected.label}のチャット`;
    frame.src = buildChatUrl(selected, location.hostname);
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.addEventListener("load", () => { loading.hidden = true; }, { once: true });
    elements.chatSlot.append(loading, frame);
  }

  return function render(state) {
    syncCards(state);
    syncAudio(state);
    renderChat(state);
    elements.count.textContent = String(state.streams.length);
    elements.empty.hidden = state.streams.length > 0;
    elements.grid.hidden = state.streams.length === 0;
    elements.grid.dataset.count = String(state.streams.length);
    elements.grid.dataset.layout = state.layoutMode;
    elements.chatPanel.hidden = !state.chatOpen;
    elements.chatToggle.setAttribute("aria-pressed", String(state.chatOpen));
    elements.chatToggle.textContent = state.chatOpen ? "チャットを隠す" : "チャットを表示";

    const selected = state.streams.find((stream) => stream.id === state.selectedId);
    elements.audioToggle.disabled = !selected;
    elements.audioToggle.setAttribute("aria-pressed", String(state.audioFocus));
    elements.audioToggle.textContent = state.audioFocus ? "選択音声のみ" : "音声フォーカス";
    elements.layoutToggle.disabled = !selected;
    elements.layoutToggle.setAttribute("aria-pressed", String(state.layoutMode === "focus"));
    elements.layoutToggle.textContent = state.layoutMode === "focus" ? "均等表示" : "注目表示";
    elements.selection.textContent = selected
      ? `チャット選択: ${selected.label}`
      : "配信はまだありません";
    document.querySelector(".workspace").classList.toggle("is-chat-closed", !state.chatOpen);
  };
}

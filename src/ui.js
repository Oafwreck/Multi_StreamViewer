import { APP_CONFIG, PROVIDER_LABELS } from "./config.js";
import { buildChatUrl, buildPlayerUrl } from "./providers.js";

export function createRenderer({ onSelect, onRemove }) {
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
    template: document.querySelector("#stream-card-template"),
  };
  const cards = new Map();
  let renderedChatKey = null;

  function createCard(stream) {
    const card = elements.template.content.firstElementChild.cloneNode(true);
    const selectButton = card.querySelector(".stream-card__select");
    const removeButton = card.querySelector(".stream-card__remove");
    const frame = card.querySelector(".stream-frame");
    const loading = card.querySelector(".embed-loading");

    card.dataset.streamId = stream.id;
    card.querySelector(".stream-card__name").textContent = stream.label;
    card.querySelector(".stream-card__provider").textContent = PROVIDER_LABELS[stream.provider];
    selectButton.setAttribute("aria-label", `${stream.label}のチャットを表示`);
    removeButton.setAttribute("aria-label", `${stream.label}を削除`);
    frame.title = `${stream.label}の配信画面`;
    frame.src = buildPlayerUrl(stream, location.hostname);

    const warningTimer = window.setTimeout(() => {
      if (!loading.hidden) loading.textContent = "読み込みが続いています。配信側の埋め込み設定も確認してください。";
    }, APP_CONFIG.embedLoadWarningMs);

    frame.addEventListener("load", () => {
      window.clearTimeout(warningTimer);
      loading.hidden = true;
    }, { once: true });
    selectButton.addEventListener("click", () => onSelect(stream.id));
    removeButton.addEventListener("click", () => onRemove(stream.id));
    return card;
  }

  function syncCards(state) {
    const liveIds = new Set(state.streams.map((stream) => stream.id));
    cards.forEach((card, id) => {
      if (!liveIds.has(id)) {
        card.remove();
        cards.delete(id);
      }
    });

    state.streams.forEach((stream) => {
      if (!cards.has(stream.id)) {
        const card = createCard(stream);
        cards.set(stream.id, card);
        elements.grid.append(card);
      }
      const card = cards.get(stream.id);
      const selected = stream.id === state.selectedId;
      card.classList.toggle("is-selected", selected);
      card.querySelector(".stream-card__select").setAttribute("aria-pressed", String(selected));
    });
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
    renderChat(state);
    elements.count.textContent = String(state.streams.length);
    elements.empty.hidden = state.streams.length > 0;
    elements.grid.hidden = state.streams.length === 0;
    elements.grid.dataset.count = String(state.streams.length);
    elements.chatPanel.hidden = !state.chatOpen;
    elements.chatToggle.setAttribute("aria-pressed", String(state.chatOpen));
    elements.chatToggle.textContent = state.chatOpen ? "チャットを隠す" : "チャットを表示";

    const selected = state.streams.find((stream) => stream.id === state.selectedId);
    elements.selection.textContent = selected
      ? `チャット選択: ${selected.label}`
      : "配信はまだありません";
    document.querySelector(".workspace").classList.toggle("is-chat-closed", !state.chatOpen);
  };
}


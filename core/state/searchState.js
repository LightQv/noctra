function normalizeSearchText(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n|\r|\n/g, " ");
}

function setSearchQuery(state, query) {
  state.searchQuery = normalizeSearchText(query);
}

function setSearchPromptVisible(state, visible) {
  state.searchPromptVisible = Boolean(visible);
}

function setSearchActive(state, active) {
  state.searchActive = Boolean(active);
}

function setSearchCounters(state, index, total) {
  const safeIndex = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  const safeTotal = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;
  state.searchMatchIndex = safeIndex;
  state.searchMatchTotal = safeTotal;
}

function resetSearchCounters(state) {
  setSearchCounters(state, 0, 0);
}

function setSearchRequestId(state, requestId) {
  if (Number.isFinite(requestId)) {
    state.searchRequestId = Math.floor(requestId);
    return;
  }
  if (typeof requestId === "string" && requestId.length > 0) {
    state.searchRequestId = requestId;
    return;
  }
  state.searchRequestId = null;
}

function setSearchHintMode(state, enabled) {
  state.searchHintMode = Boolean(enabled);
}

function setSearchHintInput(state, input) {
  state.searchHintInput = normalizeSearchText(input);
}

function setSearchVisibleHintCount(state, count) {
  const safeCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  state.searchVisibleHintCount = safeCount;
}

function setSearchLastActiveRect(state, rect) {
  if (
    rect &&
    typeof rect === "object" &&
    Number.isFinite(rect.x) &&
    Number.isFinite(rect.y) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height)
  ) {
    state.searchLastActiveRect = {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
    return;
  }
  state.searchLastActiveRect = null;
}

function resetSearchSession(state) {
  setSearchQuery(state, "");
  setSearchPromptVisible(state, false);
  setSearchActive(state, false);
  resetSearchCounters(state);
  setSearchRequestId(state, null);
  setSearchHintMode(state, false);
  setSearchHintInput(state, "");
  setSearchVisibleHintCount(state, 0);
  setSearchLastActiveRect(state, null);
}

module.exports = {
  setSearchQuery,
  setSearchPromptVisible,
  setSearchActive,
  setSearchCounters,
  resetSearchCounters,
  setSearchRequestId,
  setSearchHintMode,
  setSearchHintInput,
  setSearchVisibleHintCount,
  setSearchLastActiveRect,
  resetSearchSession,
};

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

function resetSearchSession(state) {
  setSearchQuery(state, "");
  setSearchPromptVisible(state, false);
  setSearchActive(state, false);
  resetSearchCounters(state);
  setSearchRequestId(state, null);
}

module.exports = {
  setSearchQuery,
  setSearchPromptVisible,
  setSearchActive,
  setSearchCounters,
  resetSearchCounters,
  setSearchRequestId,
  resetSearchSession,
};

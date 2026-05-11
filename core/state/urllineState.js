function normalizeUrllineText(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n|\r|\n/g, " ");
}

function clampUrllineCursor(state) {
  const max = state.urllineBuffer.length;
  const index = Number.isFinite(state.urllineCursorIndex)
    ? Math.trunc(state.urllineCursorIndex)
    : max;
  state.urllineCursorIndex = Math.max(0, Math.min(index, max));
}

function setUrllineCursor(state, index) {
  const next = Number.isFinite(index)
    ? Math.trunc(index)
    : state.urllineBuffer.length;
  state.urllineCursorIndex = Math.max(
    0,
    Math.min(next, state.urllineBuffer.length),
  );
}

function moveUrllineCursor(state, delta) {
  clampUrllineCursor(state);
  state.urllineCursorIndex = Math.max(
    0,
    Math.min(state.urllineCursorIndex + delta, state.urllineBuffer.length),
  );
}

function startUrllineEditState(state, pane, initialUrl) {
  state.urllineEditing = true;
  state.urllinePane = pane === "right" ? "right" : "left";
  state.urllineBuffer = String(initialUrl || "");
  state.urllineCursorIndex = state.urllineBuffer.length;
}

function stopUrllineEditState(state) {
  state.urllineEditing = false;
  state.urllinePane = "left";
  state.urllineBuffer = "";
  state.urllineCursorIndex = 0;
}

function insertUrllineTextAtCursor(state, text) {
  const chunk = normalizeUrllineText(text);
  if (!chunk) return false;
  clampUrllineCursor(state);
  const cursor = state.urllineCursorIndex;
  state.urllineBuffer =
    state.urllineBuffer.slice(0, cursor) +
    chunk +
    state.urllineBuffer.slice(cursor);
  state.urllineCursorIndex = cursor + chunk.length;
  return true;
}

function deleteUrllineBackward(state) {
  clampUrllineCursor(state);
  if (state.urllineCursorIndex <= 0) return false;
  const cursor = state.urllineCursorIndex;
  state.urllineBuffer =
    state.urllineBuffer.slice(0, cursor - 1) +
    state.urllineBuffer.slice(cursor);
  state.urllineCursorIndex = cursor - 1;
  return true;
}

function deleteUrllineForward(state) {
  clampUrllineCursor(state);
  const cursor = state.urllineCursorIndex;
  if (cursor >= state.urllineBuffer.length) return false;
  state.urllineBuffer =
    state.urllineBuffer.slice(0, cursor) +
    state.urllineBuffer.slice(cursor + 1);
  return true;
}

module.exports = {
  clampUrllineCursor,
  setUrllineCursor,
  moveUrllineCursor,
  startUrllineEditState,
  stopUrllineEditState,
  insertUrllineTextAtCursor,
  deleteUrllineBackward,
  deleteUrllineForward,
};

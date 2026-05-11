function normalizeCommandText(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n|\r|\n/g, " ");
}

function clampCommandCursor(state) {
  const max = state.commandBuffer.length;
  const index = Number.isFinite(state.commandCursorIndex)
    ? Math.trunc(state.commandCursorIndex)
    : max;
  state.commandCursorIndex = Math.max(0, Math.min(index, max));
}

function setCommandCursor(state, index) {
  const next = Number.isFinite(index)
    ? Math.trunc(index)
    : state.commandBuffer.length;
  state.commandCursorIndex = Math.max(
    0,
    Math.min(next, state.commandBuffer.length),
  );
}

function setCommandTarget(state, target) {
  state.commandTarget = target === "EDITOR" ? "EDITOR" : "SHELL";
}

function setCommandBuffer(state, text, cursorIndex) {
  state.commandBuffer = normalizeCommandText(text);
  if (Number.isFinite(cursorIndex)) {
    setCommandCursor(state, cursorIndex);
    return;
  }
  state.commandCursorIndex = state.commandBuffer.length;
}

function insertCommandTextAtCursor(state, text) {
  const chunk = normalizeCommandText(text);
  if (!chunk) return false;
  clampCommandCursor(state);
  const cursor = state.commandCursorIndex;
  state.commandBuffer =
    state.commandBuffer.slice(0, cursor) +
    chunk +
    state.commandBuffer.slice(cursor);
  state.commandCursorIndex = cursor + chunk.length;
  return true;
}

function moveCommandCursor(state, delta) {
  clampCommandCursor(state);
  state.commandCursorIndex = Math.max(
    0,
    Math.min(state.commandCursorIndex + delta, state.commandBuffer.length),
  );
}

function deleteCommandBackward(state) {
  clampCommandCursor(state);
  if (state.commandCursorIndex <= 0) return false;
  const cursor = state.commandCursorIndex;
  state.commandBuffer =
    state.commandBuffer.slice(0, cursor - 1) +
    state.commandBuffer.slice(cursor);
  state.commandCursorIndex = cursor - 1;
  return true;
}

function deleteCommandForward(state) {
  clampCommandCursor(state);
  const cursor = state.commandCursorIndex;
  if (cursor >= state.commandBuffer.length) return false;
  state.commandBuffer =
    state.commandBuffer.slice(0, cursor) +
    state.commandBuffer.slice(cursor + 1);
  return true;
}

module.exports = {
  clampCommandCursor,
  setCommandCursor,
  setCommandTarget,
  setCommandBuffer,
  insertCommandTextAtCursor,
  moveCommandCursor,
  deleteCommandBackward,
  deleteCommandForward,
};

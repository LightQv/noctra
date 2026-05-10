const test = require("node:test");
const assert = require("node:assert/strict");
const {
  startUrllineEditState,
  stopUrllineEditState,
  moveUrllineCursor,
  setUrllineCursor,
  insertUrllineTextAtCursor,
  deleteUrllineBackward,
  deleteUrllineForward,
} = require("../core/state/urllineState");

function createState() {
  return {
    urllineEditing: false,
    urllinePane: "left",
    urllineBuffer: "",
    urllineCursorIndex: 0,
  };
}

test("urlline lifecycle and edit operations remain stable", () => {
  const state = createState();
  startUrllineEditState(state, "right", "https://exa.com");
  assert.equal(state.urllineEditing, true);
  assert.equal(state.urllinePane, "right");
  assert.equal(state.urllineCursorIndex, state.urllineBuffer.length);

  moveUrllineCursor(state, -4);
  const cursorBeforeInsert = state.urllineCursorIndex;
  insertUrllineTextAtCursor(state, "mple");
  assert.equal(state.urllineCursorIndex, cursorBeforeInsert + 4);
  assert.equal(state.urllineBuffer.includes("example"), true);

  setUrllineCursor(state, 0);
  deleteUrllineBackward(state);
  assert.equal(state.urllineCursorIndex, 0);

  deleteUrllineForward(state);
  assert.equal(state.urllineBuffer.length > 0, true);

  stopUrllineEditState(state);
  assert.equal(state.urllineEditing, false);
  assert.equal(state.urllinePane, "left");
  assert.equal(state.urllineBuffer, "");
  assert.equal(state.urllineCursorIndex, 0);
});

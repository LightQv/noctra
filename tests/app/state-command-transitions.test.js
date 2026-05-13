const test = require("node:test");
const assert = require("node:assert/strict");
const {
  setCommandBuffer,
  setCommandCursor,
  insertCommandTextAtCursor,
  moveCommandCursor,
  deleteCommandBackward,
  deleteCommandForward,
} = require("../../core/state/commandState");

function createState() {
  return {
    commandBuffer: "",
    commandCursorIndex: 0,
    commandTarget: "SHELL",
  };
}

test("command text editing operations preserve cursor invariants", () => {
  const state = createState();
  setCommandBuffer(state, "open", 4);
  assert.equal(state.commandBuffer, "open");
  assert.equal(state.commandCursorIndex, 4);

  insertCommandTextAtCursor(state, " test");
  assert.equal(state.commandBuffer, "open test");
  assert.equal(state.commandCursorIndex, 9);

  moveCommandCursor(state, -4);
  assert.equal(state.commandCursorIndex, 5);

  deleteCommandForward(state);
  assert.equal(state.commandBuffer, "open est");
  assert.equal(state.commandCursorIndex, 5);

  deleteCommandBackward(state);
  assert.equal(state.commandBuffer, "openest");
  assert.equal(state.commandCursorIndex, 4);

  setCommandCursor(state, 999);
  assert.equal(state.commandCursorIndex, state.commandBuffer.length);
});

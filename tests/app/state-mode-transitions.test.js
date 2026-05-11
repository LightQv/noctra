const test = require("node:test");
const assert = require("node:assert/strict");
const {
  setMode,
  enterInsertMode,
  enterNormalMode,
  enterCommandMode,
  exitCommandMode,
} = require("../../core/modeTransitionService");

function createState() {
  return {
    mode: "NORMAL",
    commandTarget: "SHELL",
    commandBuffer: "",
    commandCursorIndex: 0,
  };
}

test("mode transitions are idempotent and normalized", () => {
  const state = createState();
  assert.equal(setMode(state, "NORMAL"), false);
  assert.equal(enterInsertMode(state), true);
  assert.equal(state.mode, "INSERT");
  assert.equal(enterInsertMode(state), false);
  assert.equal(enterNormalMode(state), true);
  assert.equal(state.mode, "NORMAL");
});

test("command mode entry and exit route through command state helpers", () => {
  const state = createState();
  enterCommandMode(state, {
    target: "EDITOR",
    initialText: "open dashboard",
    cursorIndex: 4,
  });

  assert.equal(state.mode, "COMMAND");
  assert.equal(state.commandTarget, "EDITOR");
  assert.equal(state.commandBuffer, "open dashboard");
  assert.equal(state.commandCursorIndex, 4);

  exitCommandMode(state);
  assert.equal(state.mode, "NORMAL");
  assert.equal(state.commandTarget, "SHELL");
  assert.equal(state.commandBuffer, "");
  assert.equal(state.commandCursorIndex, 0);
});

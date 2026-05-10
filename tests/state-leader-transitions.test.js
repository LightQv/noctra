const test = require("node:test");
const assert = require("node:assert/strict");
const {
  resetLeaderSession,
  startLeaderSession,
  pushLeaderPath,
  popLeaderPath,
  appendLeaderNumeric,
  popLeaderNumeric,
  resetSequenceBuffers,
} = require("../core/state/leaderState");

function createState() {
  return {
    leaderActive: false,
    leaderPath: [],
    leaderNumericBuffer: "",
    leaderLastKeyTime: 0,
    keyBuffer: "gg",
    countBuffer: "12",
  };
}

test("leader session transitions are deterministic", () => {
  const state = createState();
  startLeaderSession(state, 100);
  assert.equal(state.leaderActive, true);
  assert.deepEqual(state.leaderPath, []);
  assert.equal(state.leaderNumericBuffer, "");
  assert.equal(state.leaderLastKeyTime, 100);

  pushLeaderPath(state, "b", 120);
  assert.deepEqual(state.leaderPath, ["b"]);
  assert.equal(state.leaderLastKeyTime, 120);

  appendLeaderNumeric(state, "3", 140);
  assert.equal(state.leaderNumericBuffer, "3");
  assert.equal(state.leaderLastKeyTime, 140);

  popLeaderNumeric(state, 150);
  assert.equal(state.leaderNumericBuffer, "");
  assert.equal(state.leaderLastKeyTime, 150);

  popLeaderPath(state, 180);
  assert.deepEqual(state.leaderPath, []);
  assert.equal(state.leaderLastKeyTime, 180);

  resetLeaderSession(state);
  assert.equal(state.leaderActive, false);
  assert.deepEqual(state.leaderPath, []);
  assert.equal(state.leaderNumericBuffer, "");
  assert.equal(state.leaderLastKeyTime, 0);
});

test("sequence buffers reset independently from leader", () => {
  const state = createState();
  resetSequenceBuffers(state);
  assert.equal(state.keyBuffer, "");
  assert.equal(state.countBuffer, "");
});

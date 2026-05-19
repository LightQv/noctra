const test = require("node:test");
const assert = require("node:assert/strict");

const { createState } = require("../../core/state");

test("createState provides instance applyConfig", () => {
  const stateA = createState();
  const stateB = createState();

  stateA.applyConfig({
    global: {
      input: {
        leader_key: ",",
        sequence_timeout_ms: 777,
      },
      whichkey: {
        enabled: false,
        display_delay_ms: 222,
        timeout_ms: null,
      },
    },
  });

  assert.equal(stateA.leaderKey, ",");
  assert.equal(stateA.sequenceTimeout, 777);
  assert.equal(stateA.whichKeyEnabled, false);
  assert.equal(stateA.whichKeyDisplayDelay, 222);
  assert.equal(stateA.whichKeyTimeout, null);

  assert.equal(stateB.leaderKey, "Space");
  assert.equal(stateB.sequenceTimeout, 500);
  assert.equal(stateB.whichKeyEnabled, true);
  assert.equal(stateB.whichKeyDisplayDelay, 180);
  assert.equal(stateB.whichKeyTimeout, 1200);
});

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  hasSequenceTimedOut,
  consumePositiveCount,
  resolveKeySequenceMatch,
} = require("../motions/grammarPrimitives");

test("count parser keeps positive integer fallback", () => {
  assert.equal(consumePositiveCount("3", 1), 3);
  assert.equal(consumePositiveCount("0", 1), 1);
  assert.equal(consumePositiveCount("-2", 1), 1);
  assert.equal(consumePositiveCount("not-a-number", 1), 1);
});

test("sequence timeout is strict greater-than threshold", () => {
  assert.equal(hasSequenceTimedOut(1000, 950, 50), false);
  assert.equal(hasSequenceTimedOut(1001, 950, 50), true);
  assert.equal(hasSequenceTimedOut(1000, 950, Number.NaN), false);
});

test("exact sequence match remains deterministic", () => {
  const keymap = { g: "g", gg: "gg" };
  const result = resolveKeySequenceMatch(keymap, "g");
  assert.equal(result.exact, "g");
  assert.equal(result.hasPrefix, true);
});

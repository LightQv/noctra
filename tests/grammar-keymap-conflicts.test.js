const test = require("node:test");
const assert = require("node:assert/strict");

const { resolveKeySequenceMatch } = require("../motions/grammarPrimitives");

test("exact mapping wins when exact key exists", () => {
  const keymap = {
    g: () => "g",
    gg: () => "gg",
  };

  const result = resolveKeySequenceMatch(keymap, "g");
  assert.equal(typeof result.exact, "function");
  assert.equal(result.hasPrefix, true);
});

test("prefix remains pending when no exact mapping exists", () => {
  const keymap = {
    gg: () => "gg",
    gh: () => "gh",
  };

  const result = resolveKeySequenceMatch(keymap, "g");
  assert.equal(result.exact, null);
  assert.equal(result.hasPrefix, true);
});

test("non-matching sequence is rejected deterministically", () => {
  const keymap = {
    gg: () => "gg",
    gh: () => "gh",
  };

  const result = resolveKeySequenceMatch(keymap, "z");
  assert.equal(result.exact, null);
  assert.equal(result.hasPrefix, false);
});

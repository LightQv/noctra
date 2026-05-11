const test = require("node:test");
const assert = require("node:assert/strict");

function loadInvariantsWithEnv(env = {}) {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    CI: process.env.CI,
    NOCTRA_INVARIANTS: process.env.NOCTRA_INVARIANTS,
  };

  if (Object.hasOwn(env, "NODE_ENV")) process.env.NODE_ENV = env.NODE_ENV;
  if (Object.hasOwn(env, "CI")) process.env.CI = env.CI;
  if (Object.hasOwn(env, "NOCTRA_INVARIANTS"))
    process.env.NOCTRA_INVARIANTS = env.NOCTRA_INVARIANTS;

  delete require.cache[require.resolve("../../core/invariants")];
  const invariants = require("../../core/invariants");

  return {
    invariants,
    restore() {
      process.env.NODE_ENV = previous.NODE_ENV;
      process.env.CI = previous.CI;
      process.env.NOCTRA_INVARIANTS = previous.NOCTRA_INVARIANTS;
      delete require.cache[require.resolve("../../core/invariants")];
    },
  };
}

test("critical invariant throws in CI", () => {
  const { invariants, restore } = loadInvariantsWithEnv({
    NODE_ENV: "production",
    CI: "true",
    NOCTRA_INVARIANTS: "",
  });

  assert.throws(() => {
    invariants.assertInputPipelinePreconditions({
      input: { type: "keyUp" },
      priority: {},
      focusSnapshot: {},
    });
  }, /input must be normalized keyDown/);

  restore();
});

test("critical invariant can be forced strict outside CI", () => {
  const { invariants, restore } = loadInvariantsWithEnv({
    NODE_ENV: "production",
    CI: "",
    NOCTRA_INVARIANTS: "strict",
  });

  assert.throws(() => {
    invariants.assertIntentShape({});
  }, /intent must include string type/);

  restore();
});

test("advisory invariant stays warn-only in CI", () => {
  const { invariants, restore } = loadInvariantsWithEnv({
    NODE_ENV: "production",
    CI: "true",
    NOCTRA_INVARIANTS: "",
  });

  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (message) => warnings.push(String(message));

  assert.doesNotThrow(() => {
    invariants.assertModeWriteBoundary({
      mode: "NORMAL",
      state: { mode: "INSERT" },
      source: "test",
    });
  });

  console.warn = originalWarn;
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /invariant:advisory/);

  restore();
});

const test = require("node:test");
const assert = require("node:assert/strict");

const { resolveContentColorScheme } = require("../../ui/theme");

test("content mode follows app mode for light/dark/auto theme modes", () => {
  assert.equal(
    resolveContentColorScheme(
      { mode: "light", content_mode: "dark" },
      { systemPrefersDark: true },
    ),
    "light",
  );

  assert.equal(
    resolveContentColorScheme(
      { mode: "dark", content_mode: "light" },
      { systemPrefersDark: false },
    ),
    "dark",
  );

  assert.equal(
    resolveContentColorScheme(
      { mode: "auto", content_mode: "light" },
      { systemPrefersDark: true },
    ),
    "dark",
  );
});

test("custom mode honors content_mode", () => {
  assert.equal(
    resolveContentColorScheme(
      { mode: "custom", custom_base: "dark", content_mode: "light" },
      { systemPrefersDark: true },
    ),
    "light",
  );

  assert.equal(
    resolveContentColorScheme(
      { mode: "custom", custom_base: "light", content_mode: "dark" },
      { systemPrefersDark: false },
    ),
    "dark",
  );

  assert.equal(
    resolveContentColorScheme(
      { mode: "custom", custom_base: "dark", content_mode: "match" },
      { systemPrefersDark: false },
    ),
    "dark",
  );
});

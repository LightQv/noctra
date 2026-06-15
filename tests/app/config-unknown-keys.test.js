const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeConfigWithDiagnostics } = require("../../core/config/schema");

test("detects unknown top-level keys", () => {
  const result = normalizeConfigWithDiagnostics({ bad_top: true });
  assert.deepEqual(result.diagnostics.unknownKeys, ["bad_top"]);
});

test("detects unknown nested keys", () => {
  const result = normalizeConfigWithDiagnostics({
    global: { ui: { tabline: { surprise: true } } },
  });
  assert.deepEqual(result.diagnostics.unknownKeys, [
    "global.ui.tabline.surprise",
  ]);
});

test("deduplicates unknown key warnings input", () => {
  const result = normalizeConfigWithDiagnostics({
    global: {
      ui: { tabline: { surprise: true }, statusline: { surprise: true } },
    },
  });
  assert.equal(
    new Set(result.diagnostics.unknownKeys).size,
    result.diagnostics.unknownKeys.length,
  );
});

test("does not flag dynamic search key mappings as unknown", () => {
  const result = normalizeConfigWithDiagnostics({
    keymap: { search: { z: "search_next" } },
  });

  assert.deepEqual(result.diagnostics.unknownKeys, []);
});

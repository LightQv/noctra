const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("sidepanel hover path updates selection from tree rows", () => {
  const panelSource = fs.readFileSync(
    path.join(__dirname, "../../core/history/panel.js"),
    "utf-8",
  );
  assert.ok(
    panelSource.includes('if (input.type === "mouseMove")'),
    "panel must handle mouseMove events",
  );
  assert.ok(
    panelSource.includes("resolveTreeNodeFromTarget"),
    "panel must resolve row targets through helper",
  );
  assert.ok(
    panelSource.includes("applyHoverTreeNode"),
    "panel must apply hover selection through helper",
  );
});

test("telescope hover path routes row index through mouse action", () => {
  const overlaySource = fs.readFileSync(
    path.join(__dirname, "../../ui/shell/services/auxOverlayController.js"),
    "utf-8",
  );
  const mainSource = fs.readFileSync(
    path.join(__dirname, "../../main.js"),
    "utf-8",
  );
  assert.ok(
    overlaySource.includes('if (input.type === "mouseMove")'),
    "telescope overlay must handle mouseMove",
  );
  assert.ok(
    overlaySource.includes("hoverTelescopeIndex(target.index)"),
    "telescope hover should forward hovered row index",
  );
  assert.ok(
    mainSource.includes("hoverTelescopeIndex: (index) =>"),
    "main mouseActions must implement hoverTelescopeIndex",
  );
});

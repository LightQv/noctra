const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(__dirname, "../..", relativePath), "utf-8");
}

test("loading progress uses a dedicated buffer change kind", () => {
  const source = readProjectFile("browser/buffers.js");
  const loadingEmitCount = source.match(/kind: "loading"/g)?.length || 0;

  assert.ok(
    loadingEmitCount >= 5,
    "loading start/progress/finish/stop/failure paths should emit loading updates",
  );
});

test("loading buffer notifications take a narrow runtime render path", () => {
  const source = readProjectFile("runtime/windowBootstrap.js");
  const narrowPathIndex = source.indexOf('changeKind === "loading"');
  const urllineRenderIndex = source.indexOf(
    "updateUrllineRender();",
    narrowPathIndex,
  );
  const loadinglineRenderIndex = source.indexOf(
    "updateLoadinglineRender();",
    narrowPathIndex,
  );
  const tablineIndex = source.indexOf("uiShell.renderTabline(snapshot)");

  assert.notEqual(narrowPathIndex, -1, "loading change kind should be checked");
  assert.notEqual(
    urllineRenderIndex,
    -1,
    "loading changes should refresh urlline reload/stop state",
  );
  assert.notEqual(
    loadinglineRenderIndex,
    -1,
    "loading changes should refresh loadingline state",
  );
  assert.notEqual(tablineIndex, -1, "tabline render path should still exist");
  assert.ok(
    urllineRenderIndex < tablineIndex,
    "loading changes should refresh urlline before broad tabline rendering",
  );
  assert.ok(
    narrowPathIndex < tablineIndex,
    "loading changes must return before broad tabline/shell rendering",
  );
});

test("app menu rebuild ignores non-structural buffer updates", () => {
  const source = readProjectFile("main.js");
  const subscriptionIndex = source.indexOf("buffers.subscribe((_snapshot, _active, change = {})");
  const rebuildIndex = source.indexOf("appMenu.rebuild();", subscriptionIndex);
  const filterIndex = source.indexOf('change.kind === "structure"', subscriptionIndex);

  assert.notEqual(subscriptionIndex, -1, "filtered app menu subscription should exist");
  assert.notEqual(rebuildIndex, -1, "app menu rebuild should still be reachable");
  assert.notEqual(filterIndex, -1, "app menu rebuild should be structure-gated");
  assert.ok(
    filterIndex < rebuildIndex,
    "app menu rebuild must be guarded before it runs",
  );
});

test("context menu listener reconciliation ignores non-structural buffer updates", () => {
  const source = readProjectFile("runtime/contextMenuRegistration.js");
  const subscriptionIndex = source.indexOf(
    "buffers.subscribe((_snapshot, _active, change = {})",
  );
  const attachAllIndex = source.indexOf("attachAll();", subscriptionIndex);
  const filterIndex = source.indexOf('change.kind !== "structure"', subscriptionIndex);

  assert.notEqual(subscriptionIndex, -1, "filtered context menu subscription should exist");
  assert.notEqual(attachAllIndex, -1, "context menu reconciliation should still run");
  assert.notEqual(filterIndex, -1, "context menu reconciliation should be structure-gated");
  assert.ok(
    filterIndex < attachAllIndex,
    "context menu reconciliation must be guarded before it scans buffers",
  );
});

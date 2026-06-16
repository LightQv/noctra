const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(__dirname, "../..", relativePath), "utf-8");
}

test("scroll status polling avoids idle foreground work", () => {
  const source = readProjectFile("runtime/windowLifecycle.js");

  assert.match(
    source,
    /setInterval\(\(\) => \{\s*readActiveScrollPercent\(\);\s*\}, 900\)/,
    "scroll status fallback polling should run well below five times per second",
  );
  assert.match(
    source,
    /typeof win\.isFocused === "function" && !win\.isFocused\(\)/,
    "scroll status polling should skip unfocused windows",
  );
  assert.match(
    source,
    /typeof win\.isMinimized === "function" && win\.isMinimized\(\)/,
    "scroll status polling should skip minimized windows",
  );
  assert.doesNotMatch(
    source,
    /state\.mode === "COMMAND"/,
    "scroll status should keep refreshing while visible command UI is open",
  );
});

test("scroll intents request an explicit statusline refresh", () => {
  const source = readProjectFile("core/dispatcher/handlers/navigation.js");
  const refreshCalls = source.match(/\.finally\(refreshScrollStatusAfterScroll\)/g) || [];

  assert.match(
    source,
    /requestScrollStatusUpdate = \(\) => \{\}/,
    "navigation handlers should accept an optional scroll status refresh hook",
  );
  assert.match(
    source,
    /requestScrollStatusUpdate\(16\)/,
    "scroll intents should refresh statusline after one frame",
  );
  assert.ok(
    refreshCalls.length >= 5,
    "scroll, top, bottom, page down, and page up should refresh scroll status",
  );
});

test("window runtime exposes scroll status refresh to dispatcher", () => {
  const bootstrapSource = readProjectFile("runtime/windowBootstrap.js");
  const mainSource = readProjectFile("main.js");

  assert.match(
    bootstrapSource,
    /requestScrollStatusUpdate: lifecycleRuntime\?\.requestScrollStatusUpdate/,
    "window bootstrap should expose lifecycle scroll refresh hook",
  );
  assert.match(
    mainSource,
    /requestScrollStatusUpdate: \(\.\.\.args\) => requestScrollStatusUpdate\(\.\.\.args\)/,
    "dispatcher should receive a late-bound scroll refresh hook",
  );
});

test("active buffer and pane focus changes refresh scroll status", () => {
  const source = readProjectFile("runtime/windowBootstrap.js");

  assert.match(
    source,
    /if \(activeChanged \|\| change\.kind === "pane-interaction"\) \{\s*lifecycleRuntime\?\.requestScrollStatusUpdate\?\.\(16\);\s*\}/,
    "buffer and pane focus changes should refresh statusline scroll without waiting for fallback polling",
  );
});

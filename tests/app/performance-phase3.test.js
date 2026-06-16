const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(__dirname, "../..", relativePath), "utf-8");
}

test("loadingline skips repeated pane bounds and renderer updates", () => {
  const source = readProjectFile("ui/shell/manager.js");

  assert.match(
    source,
    /loadinglineLeftBoundsKey/,
    "loadingline should cache left pane bounds",
  );
  assert.match(
    source,
    /loadinglineRightRenderKey/,
    "loadingline should cache right pane renderer state",
  );
  assert.match(
    source,
    /if \(this\[boundsKey\] !== nextBoundsKey\) \{\s*view\.setBounds/,
    "loadingline should only set bounds when pane bounds change",
  );
  assert.match(
    source,
    /if \(this\[renderKey\] === nextRenderKey\) \{\s*return \{ visibilityChanged: !wasVisible \};\s*\}/,
    "loadingline should skip executeJavaScript for identical pane render state",
  );
});

test("loadingline overlay views are initialized with shell overlays", () => {
  const source = readProjectFile("ui/shell/manager.js");

  const initIndex = source.indexOf("init(windowRef)");
  const statuslineIndex = source.indexOf("this.initializeStatuslineView();", initIndex);
  const loadinglineIndex = source.indexOf(
    "this.initializeLoadinglineOverlayViews();",
    initIndex,
  );
  const toastIndex = source.indexOf("this.initializeToastOverlayView();", initIndex);

  assert.notEqual(initIndex, -1, "shell init should exist");
  assert.notEqual(loadinglineIndex, -1, "shell init should create loadingline views");
  assert.ok(
    statuslineIndex < loadinglineIndex && loadinglineIndex < toastIndex,
    "loadingline should initialize in the normal overlay stack order",
  );
});

test("loadingline only syncs overlay stack on visibility changes", () => {
  const source = readProjectFile("ui/shell/manager.js");

  assert.match(
    source,
    /if \(leftResult\.visibilityChanged \|\| rightResult\.visibilityChanged\) \{\s*this\.syncOverlayStack\(\);\s*\}/,
    "loadingline should not sync overlay stack for progress-only updates",
  );
});

test("split divider skips duplicate shell patches", () => {
  const source = readProjectFile("ui/shell/services/shellRenderBridge.js");

  assert.match(
    source,
    /currentState\.visible === visible && currentState\.offsetPx === offsetPx/,
    "split divider should compare next state with cached state",
  );
  assert.match(
    source,
    /this\.splitDividerState = \{ visible, offsetPx \};/,
    "split divider should still cache changed state before patching",
  );
});

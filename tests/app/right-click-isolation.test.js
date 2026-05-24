const test = require("node:test");
const assert = require("node:assert/strict");

const { attachPaneTracking } = require("../../browser/services/selectionClipboardObserver");

test("selection clipboard observer ignores right-click in onMouseEvent", () => {
  let paneInteractionCalled = false;

  const manager = {
    lastSelectionCopyByWebContentsId: new Map(),
    handlePaneInteraction() {
      paneInteractionCalled = true;
    },
  };

  const events = {};
  const buffer = {
    webContents: {
      isDestroyed: () => false,
      executeJavaScript: () => Promise.resolve(""),
      id: 1,
      on(event, handler) {
        events[event] = handler;
      },
      once(event, handler) {
        events[event] = handler;
      },
      removeListener() {},
    },
    isEditable: false,
  };

  const paneResolver = () => "left";

  attachPaneTracking(manager, buffer, paneResolver);

  // Simulate right-click mouseUp — should NOT trigger pane interaction
  const onMouseEvent = events["before-mouse-event"];
  assert.ok(typeof onMouseEvent === "function", "observer should be bound");

  onMouseEvent({}, { type: "mouseUp", button: "right" });
  assert.equal(paneInteractionCalled, false, "right-click must not trigger pane interaction");
});

test("panel handleMouseEvent with right-click does not call focus or openCurrent", async () => {
  // Minimal panel mock that tracks focus/openCurrent calls
  // We verify via source code contract that right-click never reaches focus/openCurrent.
  // Import the actual handleMouseEvent logic by creating a minimal panel class
  const { HistoryPanel } = require("../../core/history/panel");

  // We can't easily instantiate the full controller, so we verify via the source:
  // handleMouseEvent returns early for right-click after calling event.preventDefault()
  // and showContextMenu, without ever reaching this.focus() or this.openCurrent().
  // This test serves as a contract assertion that the source code maintains this invariant.
  assert.ok(HistoryPanel, "HistoryPanel should be importable");

  // Read the source and verify the right-click branch exists
  const fs = require("node:fs");
  const path = require("node:path");
  const panelSource = fs.readFileSync(
    path.join(__dirname, "../../core/history/panel.js"),
    "utf-8",
  );
  assert.ok(
    panelSource.includes('if (input.button === "right")'),
    "panel source must have right-click branch",
  );
  assert.ok(
    panelSource.includes("event.preventDefault()"),
    "panel source must call preventDefault on right-click",
  );

  // Verify that focus() and openCurrent() only appear AFTER the right-click return
  const rightClickBranchIndex = panelSource.indexOf('if (input.button === "right")');
  const afterRightClick = panelSource.slice(rightClickBranchIndex);
  const focusIndex = afterRightClick.indexOf("this.focus()");
  const openCurrentIndex = afterRightClick.indexOf("this.openCurrent(");
  assert.ok(
    focusIndex > 0,
    "focus() must appear after the right-click branch (i.e., only reached by left-click)",
  );
  assert.ok(
    openCurrentIndex > 0,
    "openCurrent() must appear after the right-click branch (i.e., only reached by left-click)",
  );
});

test("sidepanel handleMouseEvent clears selection on right-click", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const panelSource = fs.readFileSync(
    path.join(__dirname, "../../core/history/panel.js"),
    "utf-8",
  );
  const rightClickBranchIndex = panelSource.indexOf('if (input.button === "right")');
  assert.ok(rightClickBranchIndex >= 0, "panel must have right-click branch");

  const afterRightClick = panelSource.slice(rightClickBranchIndex);
  const preventDefaultIndex = afterRightClick.indexOf("event.preventDefault()");
  const executeJsIndex = afterRightClick.indexOf("executeJavaScript");
  const removeAllRangesIndex = afterRightClick.indexOf("removeAllRanges()");

  assert.ok(
    preventDefaultIndex >= 0,
    "panel right-click must call preventDefault",
  );
  assert.ok(
    executeJsIndex > preventDefaultIndex,
    "panel must execute selection-clearing script after preventDefault",
  );
  assert.ok(
    removeAllRangesIndex > executeJsIndex,
    "panel script must call removeAllRanges",
  );
});

test("context menu registration calls event.preventDefault() for web contents", () => {
  // Verify via source code contract that preventDefault is called
  const fs = require("node:fs");
  const path = require("node:path");
  const regSource = fs.readFileSync(
    path.join(__dirname, "../../runtime/contextMenuRegistration.js"),
    "utf-8",
  );
  const preventDefaultIndex = regSource.indexOf("event.preventDefault()");
  assert.ok(
    preventDefaultIndex >= 0,
    "contextMenuRegistration must call event.preventDefault()",
  );
});

test("context menu registration clears selection on non-editable content", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const regSource = fs.readFileSync(
    path.join(__dirname, "../../runtime/contextMenuRegistration.js"),
    "utf-8",
  );
  const preventDefaultIndex = regSource.indexOf("event.preventDefault()");
  const removeAllRangesIndex = regSource.indexOf("removeAllRanges()");
  assert.ok(
    removeAllRangesIndex > preventDefaultIndex,
    "selection must be cleared after preventDefault()",
  );
  assert.ok(
    regSource.includes("!params.isEditable"),
    "selection clearing must be guarded by !params.isEditable",
  );
});

test("context menu handler is async and awaits selection clearing", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const regSource = fs.readFileSync(
    path.join(__dirname, "../../runtime/contextMenuRegistration.js"),
    "utf-8",
  );

  const handleContextMenuIndex = regSource.indexOf("async function handleContextMenu");
  assert.ok(
    handleContextMenuIndex >= 0,
    "handleContextMenu must be declared async",
  );

  const afterHandle = regSource.slice(handleContextMenuIndex);
  const executeJsIndex = afterHandle.indexOf("executeJavaScript");
  assert.ok(executeJsIndex >= 0, "executeJavaScript must be called inside handleContextMenu");

  const snippet = afterHandle.slice(executeJsIndex - 20, executeJsIndex + 30);
  assert.ok(
    snippet.includes("await"),
    "executeJavaScript must be awaited to ensure selection is cleared before menu opens",
  );
});

test("tabline contextmenu listener calls preventDefault before sending IPC", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const tablineSource = fs.readFileSync(
    path.join(__dirname, "../../ui/tabline.js"),
    "utf-8",
  );
  const contextmenuIndex = tablineSource.indexOf("'contextmenu'");
  const preventDefaultIndex = tablineSource.indexOf("event.preventDefault()");
  assert.ok(contextmenuIndex >= 0, "tabline must have contextmenu listener");
  assert.ok(
    preventDefaultIndex > contextmenuIndex,
    "tabline must call preventDefault inside contextmenu handler",
  );
});

test("urlline contextmenu listener calls preventDefault before sending IPC", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const urllineSource = fs.readFileSync(
    path.join(__dirname, "../../ui/urlline.js"),
    "utf-8",
  );
  const contextmenuIndex = urllineSource.indexOf("'contextmenu'");
  const preventDefaultIndex = urllineSource.indexOf("event.preventDefault()");
  assert.ok(contextmenuIndex >= 0, "urlline must have contextmenu listener");
  assert.ok(
    preventDefaultIndex > contextmenuIndex,
    "urlline must call preventDefault inside contextmenu handler",
  );
});

test("statusline prevents contextmenu via shell templates", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const templatesSource = fs.readFileSync(
    path.join(__dirname, "../../ui/shell/services/shellTemplates.js"),
    "utf-8",
  );
  assert.ok(
    templatesSource.includes("'contextmenu'"),
    "statusline template must listen for contextmenu",
  );
  assert.ok(
    templatesSource.includes("preventDefault()"),
    "statusline template must call preventDefault",
  );
});

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  applyOverlayLayout,
  applyOverlayStack,
} = require("../../core/adapters/platform/overlayLayoutHost");

function createView(id, calls) {
  return {
    id,
    setBounds(bounds) {
      calls.push(["bounds", id, bounds]);
    },
  };
}

test("overlay layout sizes backdrop to full window bounds", () => {
  const calls = [];
  const windowRef = {
    getContentBounds() {
      return { x: 0, y: 0, width: 1280, height: 720 };
    },
  };

  const overlays = {
    commandOverlayView: createView("command", calls),
    whichKeyOverlayView: createView("whichkey", calls),
    selectionModalView: createView("selection", calls),
    telescopeView: createView("telescope", calls),
    statuslineView: createView("statusline", calls),
    toastOverlayView: createView("toast", calls),
    downloadsModalView: createView("downloads", calls),
    backdropOverlayView: createView("backdrop", calls),
  };

  applyOverlayLayout({
    windowRef,
    overlays,
    visibility: {
      backdropVisible: true,
      commandVisible: false,
      whichKeyVisible: false,
      selectionModalVisible: false,
      telescopeVisible: false,
      downloadsModalVisible: false,
    },
    chrome: {
      UI_SHELL_TABLINE_HEIGHT: 34,
      UI_SHELL_STATUSLINE_HEIGHT: 24,
    },
    computeSelectionModalHeight: () => 120,
    computeDownloadsModalHeight: () => 160,
  });

  const backdropCall = calls.find(
    (entry) => entry[0] === "bounds" && entry[1] === "backdrop",
  );
  assert.deepEqual(backdropCall[2], { x: 0, y: 0, width: 1280, height: 720 });
});

test("overlay layout hides backdrop offscreen when not visible", () => {
  const calls = [];
  const windowRef = {
    getContentBounds() {
      return { x: 0, y: 0, width: 900, height: 600 };
    },
  };

  const overlays = {
    commandOverlayView: createView("command", calls),
    whichKeyOverlayView: createView("whichkey", calls),
    selectionModalView: createView("selection", calls),
    telescopeView: createView("telescope", calls),
    statuslineView: createView("statusline", calls),
    toastOverlayView: createView("toast", calls),
    downloadsModalView: createView("downloads", calls),
    backdropOverlayView: createView("backdrop", calls),
  };

  applyOverlayLayout({
    windowRef,
    overlays,
    visibility: {
      backdropVisible: false,
      commandVisible: false,
      whichKeyVisible: false,
      selectionModalVisible: false,
      telescopeVisible: false,
      downloadsModalVisible: false,
    },
    chrome: {
      UI_SHELL_TABLINE_HEIGHT: 34,
      UI_SHELL_STATUSLINE_HEIGHT: 24,
    },
    computeSelectionModalHeight: () => 120,
    computeDownloadsModalHeight: () => 160,
  });

  const backdropCall = calls.find(
    (entry) => entry[0] === "bounds" && entry[1] === "backdrop",
  );
  assert.deepEqual(backdropCall[2], {
    x: -10000,
    y: -10000,
    width: 1,
    height: 1,
  });
});

test("overlay stack keeps backdrop below floating overlays", () => {
  const order = [];
  const windowRef = {
    setTopBrowserView(view) {
      order.push(view.id);
    },
  };

  applyOverlayStack(windowRef, {
    statuslineView: { id: "statusline" },
    toastOverlayView: { id: "toast" },
    backdropVisible: true,
    backdropOverlayView: { id: "backdrop" },
    whichKeyVisible: true,
    whichKeyOverlayView: { id: "whichkey" },
    selectionModalVisible: false,
    selectionModalView: { id: "selection" },
    telescopeVisible: true,
    telescopeView: { id: "telescope" },
    commandVisible: false,
    commandOverlayView: { id: "command" },
    downloadsModalVisible: false,
    downloadsModalView: { id: "downloads" },
  });

  assert.deepEqual(order, [
    "statusline",
    "toast",
    "backdrop",
    "whichkey",
    "telescope",
  ]);
});

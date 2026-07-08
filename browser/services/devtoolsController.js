const {
  createDevtoolsView,
  openSplitDevtools,
  closeSplitDevtools,
} = require("../../core/adapters/platform/devtoolsHost");
const {
  attachView,
  detachView,
} = require("../../core/adapters/platform/contentViewHost");

function isUsableDevtoolsView(view) {
  return Boolean(
    view &&
      view.webContents &&
      typeof view.webContents.isDestroyed === "function" &&
      !view.webContents.isDestroyed(),
  );
}

function getOpenDevtoolsView(buffer) {
  if (!buffer || !buffer.devtoolsSplitOpen) return null;
  return isUsableDevtoolsView(buffer.devtoolsView) ? buffer.devtoolsView : null;
}

function detachInactiveDevtoolsViews(manager, activeBuffer) {
  if (!manager.window) return;

  for (const buffer of manager.buffers) {
    if (buffer === activeBuffer) continue;
    if (isUsableDevtoolsView(buffer.devtoolsView)) {
      detachView(manager.window, buffer.devtoolsView);
    }
  }
}

function closeBufferDevtools(manager, buffer) {
  if (!buffer) return;

  const view = buffer.devtoolsView;
  if (manager.window && view) {
    detachView(manager.window, view);
  }

  closeSplitDevtools({
    targetWebContents: buffer.webContents,
    devtoolsView: view,
  });

  if (manager.devtoolsView === view) {
    manager.devtoolsView = null;
    manager.devtoolsTarget = null;
  }

  buffer.devtoolsView = null;
  buffer.devtoolsSplitOpen = false;
  buffer.devtoolsSplitRatio = null;
}

function openDevtoolsSplit(manager, ratio = 0.25) {
  const left = manager.getLeftBuffer();
  if (!left || !manager.window) return;

  if (left.devtoolsSplitOpen) {
    closeBufferDevtools(manager, left);
    manager.split.enabled = false;
    manager.split.mode = "regular";
    manager.split.ratio = 0.5;
    manager.focusedPane = "left";
    manager.layoutViews();
    manager.focusActive();
    manager.notify({ kind: "structure", activeChanged: true });
    return;
  }

  manager.destroyRightPaneBuffer();

  manager.split.enabled = true;
  manager.split.mode = "devtools";
  manager.split.ratio = ratio;
  manager.focusedPane = "left";

  if (!isUsableDevtoolsView(left.devtoolsView)) {
    left.devtoolsView = createDevtoolsView();
  }

  left.devtoolsSplitOpen = true;
  left.devtoolsSplitRatio = ratio;
  manager.devtoolsView = left.devtoolsView;
  manager.devtoolsTarget = left.webContents;
  detachInactiveDevtoolsViews(manager, left);
  attachView(manager.window, left.devtoolsView);

  openSplitDevtools({
    targetWebContents: manager.devtoolsTarget,
    devtoolsView: manager.devtoolsView,
  });

  manager.layoutViews();
  manager.notify({ kind: "structure", activeChanged: false });
}

function closeDevtoolsSplit(manager) {
  closeBufferDevtools(manager, manager.getLeftBuffer());
}

function syncDevtoolsTargetToLeftBuffer(manager) {
  const left = manager.getLeftBuffer();
  detachInactiveDevtoolsViews(manager, left);

  const nextView = getOpenDevtoolsView(left);
  if (!nextView || !manager.window) {
    manager.devtoolsView = null;
    manager.devtoolsTarget = null;
    if (manager.split.mode === "devtools") {
      manager.split.enabled = false;
      manager.split.mode = "regular";
      manager.split.ratio = 0.5;
      manager.focusedPane = "left";
    }
    return;
  }

  manager.split.enabled = true;
  manager.split.mode = "devtools";
  manager.split.ratio = Number.isFinite(left.devtoolsSplitRatio)
    ? left.devtoolsSplitRatio
    : 0.25;
  manager.focusedPane = manager.focusedPane === "right" ? "right" : "left";
  if (typeof manager.destroyRightPaneBuffer === "function") {
    manager.destroyRightPaneBuffer();
  }
  manager.devtoolsView = nextView;
  manager.devtoolsTarget = left.webContents;
  attachView(manager.window, nextView);
  openSplitDevtools({
    targetWebContents: manager.devtoolsTarget,
    devtoolsView: manager.devtoolsView,
  });
}

module.exports = {
  openDevtoolsSplit,
  closeDevtoolsSplit,
  syncDevtoolsTargetToLeftBuffer,
  closeBufferDevtools,
};

const {
  createDevtoolsView,
  openSplitDevtools,
  closeSplitDevtools,
} = require("../../core/adapters/platform/devtoolsHost");
const { attachView, detachView } = require("../../core/adapters/platform/contentViewHost");

function openDevtoolsSplit(manager, ratio = 0.25) {
  const left = manager.getLeftBuffer();
  if (!left || !manager.window) return;

  manager.destroyRightPaneBuffer();

  manager.split.enabled = true;
  manager.split.mode = "devtools";
  manager.split.ratio = ratio;
  manager.focusedPane = "left";

  if (!manager.devtoolsView) {
    manager.devtoolsView = createDevtoolsView();
    attachView(manager.window, manager.devtoolsView);
  }

  manager.devtoolsTarget = left.webContents;
  openSplitDevtools({
    targetWebContents: manager.devtoolsTarget,
    devtoolsView: manager.devtoolsView,
  });

  manager.layoutViews();
  manager.notify({ kind: "structure", activeChanged: false });
}

function closeDevtoolsSplit(manager) {
  detachView(manager.window, manager.devtoolsView);
  closeSplitDevtools({
    targetWebContents: manager.devtoolsTarget,
    devtoolsView: manager.devtoolsView,
  });

  manager.devtoolsView = null;
  manager.devtoolsTarget = null;
}

function syncDevtoolsTargetToLeftBuffer(manager) {
  if (!manager.split.enabled || manager.split.mode !== "devtools") {
    return;
  }

  const left = manager.getLeftBuffer();
  const nextTarget = left && left.webContents && !left.webContents.isDestroyed() ? left.webContents : null;
  if (!nextTarget || !manager.devtoolsView || !manager.window) {
    manager.closeRightSplit();
    return;
  }

  if (manager.devtoolsTarget === nextTarget) {
    return;
  }

  closeSplitDevtools({
    targetWebContents: manager.devtoolsTarget,
    devtoolsView: manager.devtoolsView,
  });
  manager.devtoolsTarget = nextTarget;
  openSplitDevtools({
    targetWebContents: manager.devtoolsTarget,
    devtoolsView: manager.devtoolsView,
  });
}

module.exports = {
  openDevtoolsSplit,
  closeDevtoolsSplit,
  syncDevtoolsTargetToLeftBuffer,
};

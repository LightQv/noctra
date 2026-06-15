const {
  UI_SHELL_TABLINE_HEIGHT,
  UI_SHELL_URLLINE_HEIGHT,
  UI_SHELL_STATUSLINE_HEIGHT,
} = require("../../ui/constants");
const { getConfigValue } = require("../../core/config/service");
const {
  setViewBounds,
  setViewAutoResize,
  setTopView,
} = require("../../core/adapters/platform/contentViewHost");

function canShowUrllineForBuffer(manager, buffer) {
  return Boolean(manager.urllineVisible && buffer && !buffer.isEditable);
}

function resolveVisiblePaneModels(manager) {
  if (!manager.isWindowAlive()) {
    return null;
  }

  const bounds = manager.window.getContentBounds();
  const left = manager.getLeftBuffer();
  const rightSource =
    manager.split.mode === "regular" ? manager.split.rightPaneSourceBuffer : null;
  const rightRegular =
    manager.split.mode === "regular" ? manager.split.rightPaneBuffer : null;
  const showSplit =
    manager.split.enabled &&
    (rightSource || rightRegular || manager.split.mode === "devtools");
  const dividerWidth =
    showSplit && getConfigValue("global.split.divider.enabled", true) ? 1 : 0;
  const contentX = Math.max(0, manager.leftInsetPx);
  const contentWidth = Math.max(bounds.width - contentX, 2);
  const availableSplitWidth = Math.max(contentWidth - dividerWidth, 2);
  const rightWidth = showSplit
    ? Math.max(Math.floor(availableSplitWidth * manager.split.ratio), 1)
    : 0;
  const leftWidth = showSplit
    ? Math.max(availableSplitWidth - rightWidth, 1)
    : contentWidth;
  const rightX = contentX + leftWidth + dividerWidth;

  const useMirroredRight =
    showSplit &&
    manager.split.mode === "regular" &&
    Boolean(left && rightSource && left === rightSource);

  const rightPaneBuffer =
    manager.split.mode === "regular"
      ? useMirroredRight
        ? rightRegular
        : rightSource
      : null;

  return {
    contentX,
    leftWidth,
    rightX,
    rightWidth,
    showSplit,
    leftBuffer: left,
    rightBuffer: rightPaneBuffer,
  };
}

function getUrllineRenderModel(manager) {
  const paneLayout = resolveVisiblePaneModels(manager);
  if (!paneLayout) {
    return { panes: [] };
  }

  const panes = [];
  const { contentX, leftWidth, rightX, rightWidth, showSplit, leftBuffer, rightBuffer } =
    paneLayout;

  if (canShowUrllineForBuffer(manager, leftBuffer)) {
    const leftWebContents = leftBuffer.webContents;
    const leftIsLoading = Boolean(
      leftWebContents &&
        !leftWebContents.isDestroyed?.() &&
        (leftWebContents.isLoading?.() ||
          leftWebContents.isLoadingMainFrame?.()),
    );

    panes.push({
      pane: "left",
      x: contentX,
      top: UI_SHELL_TABLINE_HEIGHT,
      width: leftWidth,
      url: leftBuffer.displayUrl || leftBuffer.url || "about:blank",
      canGoBack: Boolean(leftBuffer.webContents?.navigationHistory?.canGoBack?.()),
      canGoForward: Boolean(
        leftBuffer.webContents?.navigationHistory?.canGoForward?.(),
      ),
      isLoading: leftIsLoading,
    });
  }

  if (showSplit && canShowUrllineForBuffer(manager, rightBuffer)) {
    const rightWebContents = rightBuffer.webContents;
    const rightIsLoading = Boolean(
      rightWebContents &&
        !rightWebContents.isDestroyed?.() &&
        (rightWebContents.isLoading?.() ||
          rightWebContents.isLoadingMainFrame?.()),
    );

    panes.push({
      pane: "right",
      x: rightX,
      top: UI_SHELL_TABLINE_HEIGHT,
      width: rightWidth,
      url: rightBuffer.displayUrl || rightBuffer.url || "about:blank",
      canGoBack: Boolean(
        rightBuffer.webContents?.navigationHistory?.canGoBack?.(),
      ),
      canGoForward: Boolean(
        rightBuffer.webContents?.navigationHistory?.canGoForward?.(),
      ),
      isLoading: rightIsLoading,
    });
  }

  return { panes };
}

function getLoadinglineRenderModel(manager) {
  if (!manager.isLoadinglineVisible()) {
    return { panes: [] };
  }

  const paneLayout = resolveVisiblePaneModels(manager);
  if (!paneLayout) {
    return { panes: [] };
  }

  const { contentX, leftWidth, rightX, rightWidth, showSplit, leftBuffer, rightBuffer } =
    paneLayout;
  const panes = [];

  const pushPane = (pane, buffer, x, width, hasUrlline) => {
    if (!buffer || buffer.isEditable) {
      return;
    }
    const webContents = buffer.webContents;
    const isLoading = Boolean(
      webContents &&
        !webContents.isDestroyed?.() &&
        (webContents.isLoading?.() || webContents.isLoadingMainFrame?.()),
    );

    panes.push({
      pane,
      x,
      top: UI_SHELL_TABLINE_HEIGHT + (hasUrlline ? UI_SHELL_URLLINE_HEIGHT : 0),
      width,
      isLoading,
      loadingProgress:
        typeof buffer.loadingState?.progress === "number"
          ? Math.max(0, Math.min(1, buffer.loadingState.progress))
          : null,
      loadingIndeterminate: Boolean(buffer.loadingState?.indeterminate),
    });
  };

  pushPane(
    "left",
    leftBuffer,
    contentX,
    leftWidth,
    canShowUrllineForBuffer(manager, leftBuffer),
  );
  if (showSplit) {
    pushPane(
      "right",
      rightBuffer,
      rightX,
      rightWidth,
      canShowUrllineForBuffer(manager, rightBuffer),
    );
  }

  return { panes };
}

function layoutViews(manager) {
  if (!manager.window) return;

  const bounds = manager.window.getContentBounds();
  const shellTop = UI_SHELL_TABLINE_HEIGHT;
  const shellBottomInset = UI_SHELL_STATUSLINE_HEIGHT;

  const left = manager.getLeftBuffer();
  const rightSource =
    manager.split.mode === "regular"
      ? manager.split.rightPaneSourceBuffer
      : null;
  const rightRegular =
    manager.split.mode === "regular" ? manager.split.rightPaneBuffer : null;
  const showSplit =
    manager.split.enabled &&
    (rightSource || rightRegular || manager.split.mode === "devtools");

  const useMirroredRight =
    showSplit &&
    manager.split.mode === "regular" &&
    Boolean(left && rightSource && left === rightSource);

  if (useMirroredRight && !manager.split.rightPaneBuffer) {
    manager.ensureRightPaneBuffer();
  }

  const showSplitWithRegular =
    manager.split.enabled && (Boolean(rightSource) || Boolean(rightRegular));

  const visibleRightMainBuffer =
    manager.split.mode === "regular" && rightSource && !useMirroredRight
      ? rightSource
      : null;

  const rightVisibleBuffer =
    manager.split.mode === "regular" && useMirroredRight
      ? rightRegular
      : visibleRightMainBuffer;

  const leftHasUrlline = canShowUrllineForBuffer(manager, left);
  const rightHasUrlline = canShowUrllineForBuffer(manager, rightVisibleBuffer);

  const getPaneInset = (isRightPane) => {
    if (!showSplit) {
      return leftHasUrlline ? UI_SHELL_URLLINE_HEIGHT : 0;
    }

    return isRightPane
      ? rightHasUrlline
        ? UI_SHELL_URLLINE_HEIGHT
        : 0
      : leftHasUrlline
        ? UI_SHELL_URLLINE_HEIGHT
        : 0;
  };

  const getPaneBounds = (isRightPane, x, width) => {
    const paneInset = getPaneInset(isRightPane);
    const y = shellTop + paneInset;
    const height = Math.max(
      bounds.height - shellTop - shellBottomInset - paneInset,
      1,
    );
    return {
      x,
      y,
      width,
      height,
    };
  };

  const splitDividerEnabled = getConfigValue(
    "global.split.divider.enabled",
    true,
  );
  const dividerWidth = showSplit && splitDividerEnabled ? 1 : 0;
  const contentX = Math.max(0, manager.leftInsetPx);
  const contentWidth = Math.max(bounds.width - contentX, 2);
  const availableSplitWidth = Math.max(contentWidth - dividerWidth, 2);
  const rightWidth = showSplit
    ? Math.max(Math.floor(availableSplitWidth * manager.split.ratio), 1)
    : 0;
  const leftWidth = showSplit
    ? Math.max(availableSplitWidth - rightWidth, 1)
    : contentWidth;
  const rightX = contentX + leftWidth + dividerWidth;

  manager.splitDivider.visible = showSplit && dividerWidth > 0;
  manager.splitDivider.offsetPx = manager.splitDivider.visible
    ? contentX + leftWidth
    : 0;

  for (const buffer of manager.buffers) {
    if (buffer === left || buffer === visibleRightMainBuffer) {
      const isRightBuffer = buffer === visibleRightMainBuffer;
      setViewBounds(
        buffer.view,
        getPaneBounds(
          isRightBuffer,
          isRightBuffer ? rightX : contentX,
          isRightBuffer ? rightWidth : leftWidth,
        ),
      );
      setViewAutoResize(buffer.view, {
        width: !showSplitWithRegular,
        height: true,
      });
    } else {
      setViewAutoResize(buffer.view, { width: false, height: false });
      setViewBounds(buffer.view, { x: -10000, y: -10000, width: 1, height: 1 });
    }
  }

  if (rightRegular) {
    if (showSplit && manager.split.mode === "regular" && useMirroredRight) {
      const sourceUrl = manager.resolveBufferMirrorUrl(rightSource);
      if (rightRegular.url !== sourceUrl) {
        rightRegular.load(sourceUrl);
      }

      setViewBounds(rightRegular.view, getPaneBounds(true, rightX, rightWidth));
      setViewAutoResize(rightRegular.view, { width: !showSplit, height: true });
    } else {
      setViewAutoResize(rightRegular.view, { width: false, height: false });
      setViewBounds(rightRegular.view, {
        x: -10000,
        y: -10000,
        width: 1,
        height: 1,
      });
    }
  }

  if (manager.devtoolsView) {
    if (showSplit && manager.split.mode === "devtools") {
      setViewBounds(
        manager.devtoolsView,
        getPaneBounds(true, rightX, rightWidth),
      );
      setViewAutoResize(manager.devtoolsView, {
        width: !showSplit,
        height: true,
      });
    } else {
      setViewAutoResize(manager.devtoolsView, { width: false, height: false });
      setViewBounds(manager.devtoolsView, {
        x: -10000,
        y: -10000,
        width: 1,
        height: 1,
      });
    }
  }

  if (typeof manager.window.setTopBrowserView === "function") {
    if (showSplit && manager.focusedPane === "right") {
      if (manager.split.mode === "regular") {
        if (useMirroredRight && rightRegular) {
          setTopView(manager.window, rightRegular.view);
        } else if (visibleRightMainBuffer) {
          setTopView(manager.window, visibleRightMainBuffer.view);
        }
      } else if (manager.split.mode === "devtools" && manager.devtoolsView) {
        setTopView(manager.window, manager.devtoolsView);
      }
    } else if (left) {
      setTopView(manager.window, left.view);
    }
  }
}

module.exports = {
  canShowUrllineForBuffer,
  getUrllineRenderModel,
  getLoadinglineRenderModel,
  layoutViews,
};

function applyOverlayLayout({
  windowRef,
  overlays,
  visibility,
  chrome,
  computeSelectionModalHeight,
  computeDownloadsModalHeight,
  computeToastOverlayHeight,
}) {
  if (!windowRef) {
    return;
  }

  const {
    commandOverlayView,
    whichKeyOverlayView,
    selectionModalView,
    telescopeView,
    statuslineView,
    toastOverlayView,
    downloadsModalView,
    backdropOverlayView,
    contextMenuOverlayView,
  } = overlays || {};

  if (
    !commandOverlayView ||
    !whichKeyOverlayView ||
    !selectionModalView ||
    !telescopeView ||
    !statuslineView ||
    !toastOverlayView ||
    !downloadsModalView ||
    !backdropOverlayView
  ) {
    return;
  }

  const { UI_SHELL_TABLINE_HEIGHT, UI_SHELL_STATUSLINE_HEIGHT } = chrome || {};
  const bounds = windowRef.getContentBounds();

  const commandVisible = Boolean(visibility && visibility.commandVisible);
  const whichKeyVisible = Boolean(visibility && visibility.whichKeyVisible);
  const selectionModalVisible = Boolean(
    visibility && visibility.selectionModalVisible,
  );
  const telescopeVisible = Boolean(visibility && visibility.telescopeVisible);
  const toastVisible = Boolean(visibility && visibility.toastVisible);
  const downloadsModalVisible = Boolean(
    visibility && visibility.downloadsModalVisible,
  );
  const backdropVisible = Boolean(visibility && visibility.backdropVisible);

  backdropOverlayView.setBounds(
    backdropVisible
      ? {
          x: 0,
          y: 0,
          width: Math.max(bounds.width, 1),
          height: Math.max(bounds.height, 1),
        }
      : { x: -10000, y: -10000, width: 1, height: 1 },
  );

  const contextMenuVisible = Boolean(
    visibility && visibility.contextMenuVisible,
  );
  if (contextMenuVisible && contextMenuOverlayView) {
    contextMenuOverlayView.setBounds({
      x: 0,
      y: 0,
      width: Math.max(bounds.width, 1),
      height: Math.max(bounds.height, 1),
    });
  } else if (contextMenuOverlayView) {
    contextMenuOverlayView.setBounds({
      x: -10000,
      y: -10000,
      width: 1,
      height: 1,
    });
  }

  const width = commandVisible
    ? Math.min(500, Math.max(bounds.width - 160, 300))
    : 1;
  const height = commandVisible ? 42 : 1;
  const x = commandVisible
    ? Math.max(Math.floor((bounds.width - width) / 2), 0)
    : -10000;
  const y = commandVisible
    ? Math.max(
        Math.floor((bounds.height - height) / 2),
        UI_SHELL_TABLINE_HEIGHT + 10,
      )
    : -10000;
  commandOverlayView.setBounds({ x, y, width, height });

  const whichWidth = whichKeyVisible
    ? Math.min(980, Math.max(bounds.width - 28, 560))
    : 1;
  const whichHeight = whichKeyVisible ? 160 : 1;
  const whichX = whichKeyVisible
    ? Math.max(Math.floor((bounds.width - whichWidth) / 2), 0)
    : -10000;
  const whichY = whichKeyVisible
    ? Math.max(
        bounds.height - UI_SHELL_STATUSLINE_HEIGHT - whichHeight - 12,
        UI_SHELL_TABLINE_HEIGHT + 12,
      )
    : -10000;
  whichKeyOverlayView.setBounds({
    x: whichX,
    y: whichY,
    width: whichWidth,
    height: whichHeight,
  });

  const modalWidth = selectionModalVisible
    ? Math.min(560, Math.max(bounds.width - 120, 320))
    : 1;
  const modalHeight = selectionModalVisible ? computeSelectionModalHeight() : 1;
  const modalX = selectionModalVisible
    ? Math.max(Math.floor((bounds.width - modalWidth) / 2), 0)
    : -10000;
  const modalY = selectionModalVisible
    ? Math.max(UI_SHELL_TABLINE_HEIGHT + 12, 0)
    : -10000;
  selectionModalView.setBounds({
    x: modalX,
    y: modalY,
    width: modalWidth,
    height: modalHeight,
  });

  const telescopeWidth = telescopeVisible
    ? Math.min(980, Math.max(bounds.width - 28, 560))
    : 1;
  const telescopeHeight = telescopeVisible
    ? Math.max(
        240,
        Math.floor(
          (bounds.height -
            UI_SHELL_TABLINE_HEIGHT -
            UI_SHELL_STATUSLINE_HEIGHT) *
            0.68,
        ),
      )
    : 1;
  const telescopeX = telescopeVisible
    ? Math.max(Math.floor((bounds.width - telescopeWidth) / 2), 0)
    : -10000;
  const telescopeY = telescopeVisible
    ? Math.max(
        UI_SHELL_TABLINE_HEIGHT + 10,
        Math.floor(
          (bounds.height - UI_SHELL_STATUSLINE_HEIGHT - telescopeHeight) / 2,
        ),
      )
    : -10000;
  telescopeView.setBounds({
    x: telescopeX,
    y: telescopeY,
    width: telescopeWidth,
    height: telescopeHeight,
  });

  const downloadsModalWidth = downloadsModalVisible
    ? Math.min(980, Math.max(bounds.width - 28, 560))
    : 1;
  const downloadsModalHeight = downloadsModalVisible
    ? (computeDownloadsModalHeight || (() => 160))()
    : 1;
  const downloadsModalX = downloadsModalVisible
    ? Math.max(Math.floor((bounds.width - downloadsModalWidth) / 2), 0)
    : -10000;
  const downloadsModalY = downloadsModalVisible
    ? Math.max(UI_SHELL_TABLINE_HEIGHT + 12, 0)
    : -10000;
  downloadsModalView.setBounds({
    x: downloadsModalX,
    y: downloadsModalY,
    width: downloadsModalWidth,
    height: downloadsModalHeight,
  });

  statuslineView.setBounds({
    x: 0,
    y: Math.max(
      bounds.height - UI_SHELL_STATUSLINE_HEIGHT,
      UI_SHELL_TABLINE_HEIGHT + 1,
    ),
    width: bounds.width,
    height: UI_SHELL_STATUSLINE_HEIGHT,
  });

  const toastWidth = toastVisible ? Math.min(452, Math.max(bounds.width, 1)) : 1;
  const toastHeight = toastVisible
    ? Math.min(
        Math.max((computeToastOverlayHeight || (() => 1))(), 1),
        Math.max(bounds.height - UI_SHELL_TABLINE_HEIGHT - 10, 1),
      )
    : 1;
  const toastX = toastVisible ? Math.max(bounds.width - toastWidth, 0) : -10000;
  const toastY = toastVisible ? Math.max(UI_SHELL_TABLINE_HEIGHT + 10, 0) : -10000;
  toastOverlayView.setBounds({
    x: toastX,
    y: toastY,
    width: toastWidth,
    height: toastHeight,
  });
}

function applyOverlayStack(windowRef, stack = {}) {
  if (!windowRef || typeof windowRef.setTopBrowserView !== "function") {
    return;
  }

  if (stack.statuslineView) {
    windowRef.setTopBrowserView(stack.statuslineView);
  }

  if (stack.loadinglineLeftVisible && stack.loadinglineLeftView) {
    windowRef.setTopBrowserView(stack.loadinglineLeftView);
  }

  if (stack.loadinglineRightVisible && stack.loadinglineRightView) {
    windowRef.setTopBrowserView(stack.loadinglineRightView);
  }

  if (stack.toastVisible && stack.toastOverlayView) {
    windowRef.setTopBrowserView(stack.toastOverlayView);
  }

  if (stack.backdropVisible && stack.backdropOverlayView) {
    windowRef.setTopBrowserView(stack.backdropOverlayView);
  }

  if (stack.whichKeyVisible && stack.whichKeyOverlayView) {
    windowRef.setTopBrowserView(stack.whichKeyOverlayView);
  }

  if (stack.selectionModalVisible && stack.selectionModalView) {
    windowRef.setTopBrowserView(stack.selectionModalView);
  }

  if (stack.telescopeVisible && stack.telescopeView) {
    windowRef.setTopBrowserView(stack.telescopeView);
  }

  if (stack.commandVisible && stack.commandOverlayView) {
    windowRef.setTopBrowserView(stack.commandOverlayView);
  }

  if (stack.downloadsModalVisible && stack.downloadsModalView) {
    windowRef.setTopBrowserView(stack.downloadsModalView);
  }

  if (stack.contextMenuVisible && stack.contextMenuOverlayView) {
    windowRef.setTopBrowserView(stack.contextMenuOverlayView);
  }
}

module.exports = {
  applyOverlayLayout,
  applyOverlayStack,
};

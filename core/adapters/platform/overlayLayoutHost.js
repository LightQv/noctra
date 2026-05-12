function applyOverlayLayout({
  windowRef,
  overlays,
  visibility,
  chrome,
  computeSelectionModalHeight,
  computeDownloadsModalHeight,
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
  } = overlays || {};

  if (
    !commandOverlayView ||
    !whichKeyOverlayView ||
    !selectionModalView ||
    !telescopeView ||
    !statuslineView ||
    !toastOverlayView ||
    !downloadsModalView
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
  const downloadsModalVisible = Boolean(
    visibility && visibility.downloadsModalVisible,
  );

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
    ? Math.min(560, Math.max(bounds.width - 120, 320))
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

  toastOverlayView.setBounds({
    x: Math.max(bounds.width - 452, 0),
    y: UI_SHELL_TABLINE_HEIGHT + 10,
    width: Math.min(452, bounds.width),
    height: Math.max(
      bounds.height - UI_SHELL_TABLINE_HEIGHT - UI_SHELL_STATUSLINE_HEIGHT - 20,
      1,
    ),
  });
}

function applyOverlayStack(windowRef, stack = {}) {
  if (!windowRef || typeof windowRef.setTopBrowserView !== "function") {
    return;
  }

  if (stack.statuslineView) {
    windowRef.setTopBrowserView(stack.statuslineView);
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

  if (stack.toastOverlayView) {
    windowRef.setTopBrowserView(stack.toastOverlayView);
  }
}

module.exports = {
  applyOverlayLayout,
  applyOverlayStack,
};

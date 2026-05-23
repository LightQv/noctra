const { createWebContextMenuActions } = require("../core/adapters/platform/contextMenuActions");
const { buildWebContextMenuTemplate } = require("../core/adapters/platform/contextMenuBuilder");

function registerWebContextMenu({
  win,
  buffers,
  configService,
  dispatch,
  state,
  INTENTS,
  validateNavigableUrl,
  isBookmarkableBuffer,
  clipboard,
  dialog,
  uiShell,
}) {
  const createActions = createWebContextMenuActions({
    clipboard,
    dialog,
    buffers,
    dispatch,
    state,
    INTENTS,
    configService,
    validateNavigableUrl,
    isBookmarkableBuffer,
    win,
  });

  async function handleContextMenu(event, params, webContents) {
    if (params.mediaType === "video" && params.hasVideoContents) {
      return;
    }

    event.preventDefault();

    if (!params.isEditable && webContents && !webContents.isDestroyed()) {
      try {
        await webContents.executeJavaScript(
          "window.getSelection && window.getSelection().removeAllRanges()",
          true,
        );
      } catch {
        // ignore
      }
    }

    let canGoBack = false;
    let canGoForward = false;

    if (webContents && !webContents.isDestroyed()) {
      if (webContents.navigationHistory) {
        canGoBack = Boolean(
          webContents.navigationHistory.canGoBack?.(),
        );
        canGoForward = Boolean(
          webContents.navigationHistory.canGoForward?.(),
        );
      }
    }

    const defaultSearchEngine = configService.getConfigValue(
      "browser.default_search_engine",
      "duckduckgo",
    );

    const rightPaneBuffer = buffers.getRightPaneBuffer();
    const isRightPane = Boolean(
      rightPaneBuffer && rightPaneBuffer.webContents === webContents,
    );

    const targetBuffer = buffers.getBufferByWebContents(webContents);
    const isBookmarkable = Boolean(
      targetBuffer && isBookmarkableBuffer(targetBuffer),
    );

    const actions = createActions(webContents, params);

    const template = buildWebContextMenuTemplate({
      params,
      runtimeSnapshot: {
        canGoBack,
        canGoForward,
        defaultSearchEngine,
        isSplitEnabled: buffers.isSplitEnabled(),
        isRightPane,
        isBookmarkable,
      },
      actions,
    });

    if (!template || template.length === 0) return;

    // Convert webContents-relative coordinates to window coordinates
    let offsetX = 0;
    let offsetY = 0;
    if (
      targetBuffer &&
      targetBuffer.view &&
      typeof targetBuffer.view.getBounds === "function"
    ) {
      const b = targetBuffer.view.getBounds();
      offsetX = b.x;
      offsetY = b.y;
    }

    if (uiShell && typeof uiShell.showContextMenu === "function") {
      uiShell.showContextMenu(template, params.x + offsetX, params.y + offsetY);
    }
  }

  const disposables = new Map();

  function attach(targetWebContents, buffer = null) {
    if (!targetWebContents || targetWebContents.isDestroyed()) return;
    if (buffer && buffer.isEditable) return;
    const id = targetWebContents.id;
    if (disposables.has(id)) return;

    const listener = (event, params) =>
      handleContextMenu(event, params, targetWebContents);
    targetWebContents.on("context-menu", listener);

    const cleanup = () => {
      if (!targetWebContents.isDestroyed()) {
        try {
          targetWebContents.removeListener("context-menu", listener);
        } catch {
          // ignore
        }
      }
      disposables.delete(id);
    };

    targetWebContents.once("destroyed", cleanup);
    disposables.set(id, cleanup);
  }

  function attachAll() {
    for (const buffer of buffers.getBuffers()) {
      if (buffer && buffer.webContents) {
        attach(buffer.webContents, buffer);
      }
    }
    if (buffers.split && buffers.split.rightPaneBuffer && buffers.split.rightPaneBuffer.webContents) {
      attach(buffers.split.rightPaneBuffer.webContents, buffers.split.rightPaneBuffer);
    }
  }

  attachAll();

  const unsubscribe = buffers.subscribe(() => {
    attachAll();

    const currentIds = new Set();
    for (const buffer of buffers.getBuffers()) {
      if (buffer && buffer.webContents && !buffer.webContents.isDestroyed() && !buffer.isEditable) {
        currentIds.add(buffer.webContents.id);
      }
    }
    if (
      buffers.split &&
      buffers.split.rightPaneBuffer &&
      buffers.split.rightPaneBuffer.webContents &&
      !buffers.split.rightPaneBuffer.webContents.isDestroyed() &&
      !buffers.split.rightPaneBuffer.isEditable
    ) {
      currentIds.add(buffers.split.rightPaneBuffer.webContents.id);
    }

    for (const [id, cleanup] of disposables) {
      if (!currentIds.has(id)) {
        cleanup();
      }
    }
  });

  return () => {
    unsubscribe();
    for (const cleanup of disposables.values()) {
      cleanup();
    }
    disposables.clear();
  };
}

module.exports = {
  registerWebContextMenu,
};

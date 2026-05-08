function isUsableWebContents(webContents) {
  return Boolean(webContents && !webContents.isDestroyed());
}

function bindWebModeTracking(webContents, callbacks = {}) {
  if (!isUsableWebContents(webContents)) {
    return () => {};
  }

  const onFocusChangedInPage =
    typeof callbacks.onFocusChangedInPage === "function"
      ? callbacks.onFocusChangedInPage
      : () => {};
  const onBeforeMouseEvent =
    typeof callbacks.onBeforeMouseEvent === "function" ? callbacks.onBeforeMouseEvent : () => {};
  const onDidFinishLoad =
    typeof callbacks.onDidFinishLoad === "function" ? callbacks.onDidFinishLoad : () => {};

  webContents.on("focus-changed-in-page", onFocusChangedInPage);
  webContents.on("before-mouse-event", onBeforeMouseEvent);
  webContents.on("did-finish-load", onDidFinishLoad);

  return () => {
    if (!isUsableWebContents(webContents)) {
      return;
    }
    webContents.removeListener("focus-changed-in-page", onFocusChangedInPage);
    webContents.removeListener("before-mouse-event", onBeforeMouseEvent);
    webContents.removeListener("did-finish-load", onDidFinishLoad);
  };
}

module.exports = {
  bindWebModeTracking,
};

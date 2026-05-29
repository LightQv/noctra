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
    typeof callbacks.onBeforeMouseEvent === "function"
      ? callbacks.onBeforeMouseEvent
      : () => {};
  const onDidFinishLoad =
    typeof callbacks.onDidFinishLoad === "function"
      ? callbacks.onDidFinishLoad
      : () => {};
  const onDidStartNavigation =
    typeof callbacks.onDidStartNavigation === "function"
      ? callbacks.onDidStartNavigation
      : () => {};
  const onDidNavigate =
    typeof callbacks.onDidNavigate === "function"
      ? callbacks.onDidNavigate
      : () => {};
  const onDidNavigateInPage =
    typeof callbacks.onDidNavigateInPage === "function"
      ? callbacks.onDidNavigateInPage
      : () => {};

  webContents.on("focus-changed-in-page", onFocusChangedInPage);
  webContents.on("before-mouse-event", onBeforeMouseEvent);
  webContents.on("did-finish-load", onDidFinishLoad);
  webContents.on("did-start-navigation", onDidStartNavigation);
  webContents.on("did-navigate", onDidNavigate);
  webContents.on("did-navigate-in-page", onDidNavigateInPage);

  return () => {
    if (!isUsableWebContents(webContents)) {
      return;
    }
    webContents.removeListener("focus-changed-in-page", onFocusChangedInPage);
    webContents.removeListener("before-mouse-event", onBeforeMouseEvent);
    webContents.removeListener("did-finish-load", onDidFinishLoad);
    webContents.removeListener("did-start-navigation", onDidStartNavigation);
    webContents.removeListener("did-navigate", onDidNavigate);
    webContents.removeListener("did-navigate-in-page", onDidNavigateInPage);
  };
}

module.exports = {
  bindWebModeTracking,
};

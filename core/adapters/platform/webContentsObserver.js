function isUsableWebContents(webContents) {
  return Boolean(webContents && !webContents.isDestroyed());
}

async function readSelection(webContents) {
  if (!isUsableWebContents(webContents)) {
    return "";
  }

  if (typeof webContents.getSelectedText === "function") {
    return String(webContents.getSelectedText() || "").trim();
  }

  const resolvedSelection = await webContents.executeJavaScript(
    `window.getSelection ? window.getSelection().toString() : ""`,
  );
  return String(resolvedSelection || "").trim();
}

function bindPaneObservers(webContents, handlers = {}) {
  if (!isUsableWebContents(webContents)) {
    return () => {};
  }

  const onMouseEvent =
    typeof handlers.onMouseEvent === "function" ? handlers.onMouseEvent : () => {};
  const onFocus = typeof handlers.onFocus === "function" ? handlers.onFocus : () => {};
  const onDestroyed =
    typeof handlers.onDestroyed === "function" ? handlers.onDestroyed : () => {};

  webContents.on("before-mouse-event", onMouseEvent);
  webContents.on("focus", onFocus);
  webContents.once("destroyed", onDestroyed);

  return () => {
    if (!isUsableWebContents(webContents)) {
      return;
    }
    webContents.removeListener("before-mouse-event", onMouseEvent);
    webContents.removeListener("focus", onFocus);
  };
}

module.exports = {
  bindPaneObservers,
  readSelection,
};

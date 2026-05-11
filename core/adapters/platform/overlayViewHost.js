const { BrowserView } = require("electron");

const OVERLAY_WEB_PREFERENCES = {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  webviewTag: false,
};

function createOverlayBrowserView(html) {
  const view = new BrowserView({
    webPreferences: {
      ...OVERLAY_WEB_PREFERENCES,
    },
  });

  view.webContents.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(String(html || ""))}`,
  );
  return view;
}

function attachOverlayBrowserView(windowRef, view) {
  if (!windowRef || !view || typeof windowRef.addBrowserView !== "function") {
    return;
  }
  windowRef.addBrowserView(view);
}

module.exports = {
  createOverlayBrowserView,
  attachOverlayBrowserView,
};

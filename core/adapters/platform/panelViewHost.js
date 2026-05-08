const { BrowserView } = require("electron");
const { markSurfaceRole, SURFACE_ROLES } = require("../../security/surfaceTrust");

function createPanelViewHost({ windowRef, onMouseDown, onFocus }) {
  if (!windowRef || windowRef.isDestroyed()) {
    return null;
  }

  const view = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
    },
  });

  windowRef.addBrowserView(view);
  markSurfaceRole(view.webContents, SURFACE_ROLES.TRUSTED_PANEL);

  view.webContents.on("before-mouse-event", (_event, input) => {
    if (!input || input.type !== "mouseDown") return;
    if (typeof onMouseDown === "function") {
      onMouseDown();
    }
  });

  view.webContents.on("focus", () => {
    if (typeof onFocus === "function") {
      onFocus();
    }
  });

  function getWebContents() {
    if (!view || !view.webContents || view.webContents.isDestroyed()) {
      return null;
    }
    return view.webContents;
  }

  function show(bounds) {
    if (!view) return;
    view.setBounds(bounds);
    view.setAutoResize({ width: false, height: true });
  }

  function hide() {
    if (!view) return;
    view.setBounds({ x: -10000, y: -10000, width: 1, height: 1 });
    view.setAutoResize({ width: false, height: false });
  }

  function focusTop() {
    if (!windowRef || windowRef.isDestroyed()) return;
    if (typeof windowRef.setTopBrowserView !== "function") return;
    windowRef.setTopBrowserView(view);
  }

  function destroy() {
    if (!windowRef || windowRef.isDestroyed()) return;
    if (windowRef.getBrowserViews().includes(view)) {
      windowRef.removeBrowserView(view);
    }
    if (view.webContents && !view.webContents.isDestroyed()) {
      view.webContents.destroy();
    }
  }

  return {
    getWebContents,
    show,
    hide,
    focusTop,
    destroy,
  };
}

module.exports = {
  createPanelViewHost,
};

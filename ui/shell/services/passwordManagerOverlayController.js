const DEFAULT_POPUP_WIDTH = 420;
const DEFAULT_POPUP_HEIGHT = 560;

function isLiveWindow(win) {
  return Boolean(win && typeof win.isDestroyed === "function" && !win.isDestroyed());
}

function getPopupWindow(popup) {
  return popup && popup.browserWindow ? popup.browserWindow : null;
}

function safeBounds(bounds, fallback = {}) {
  return {
    x: Number.isFinite(bounds?.x) ? bounds.x : fallback.x || 0,
    y: Number.isFinite(bounds?.y) ? bounds.y : fallback.y || 0,
    width: Number.isFinite(bounds?.width)
      ? bounds.width
      : fallback.width || DEFAULT_POPUP_WIDTH,
    height: Number.isFinite(bounds?.height)
      ? bounds.height
      : fallback.height || DEFAULT_POPUP_HEIGHT,
  };
}

function centerBounds(parentBounds, popupBounds) {
  const parent = safeBounds(parentBounds, {
    width: DEFAULT_POPUP_WIDTH,
    height: DEFAULT_POPUP_HEIGHT,
  });
  const popup = safeBounds(popupBounds, {
    width: DEFAULT_POPUP_WIDTH,
    height: DEFAULT_POPUP_HEIGHT,
  });
  const width = Math.max(1, Math.floor(popup.width));
  const height = Math.max(1, Math.floor(popup.height));
  return {
    x: Math.floor(parent.x + Math.max(0, (parent.width - width) / 2)),
    y: Math.floor(parent.y + Math.max(0, (parent.height - height) / 2)),
    width,
    height,
  };
}

class PasswordManagerOverlayController {
  constructor({
    getParentWindow,
    focusActiveEditorSurface,
    markSurfaceRole,
    extensionRole,
  } = {}) {
    this.getParentWindow = getParentWindow;
    this.focusActiveEditorSurface = focusActiveEditorSurface;
    this.markSurfaceRole = markSurfaceRole;
    this.extensionRole = extensionRole;
    this.popup = null;
    this.popupWindow = null;
    this.cleanupFns = [];
  }

  handlePopupCreated(popup) {
    this.close({ restoreFocus: false });
    const popupWindow = getPopupWindow(popup);
    if (!popupWindow) {
      return false;
    }

    this.popup = popup;
    this.popupWindow = popupWindow;
    this.markExtensionSurface(popupWindow);
    this.bindPopup(popup, popupWindow);
    this.centerPopup();
    return true;
  }

  markExtensionSurface(popupWindow) {
    const webContents = popupWindow && popupWindow.webContents;
    if (
      webContents &&
      typeof this.markSurfaceRole === "function" &&
      this.extensionRole
    ) {
      this.markSurfaceRole(webContents, this.extensionRole);
    }
  }

  bindPopup(popup, popupWindow) {
    const parentWindow = this.getParentWindow ? this.getParentWindow() : null;
    const onClosed = () => this.releasePopup({ restoreFocus: true });
    const onEscape = (_event, input = {}) => {
      if (input.key === "Escape" || input.code === "Escape") {
        this.close();
      }
    };
    const onResize = () => this.centerPopup();

    if (popup && typeof popup.on === "function") {
      popup.on("resized", onResize);
      this.cleanupFns.push(() => popup.off && popup.off("resized", onResize));
    }

    if (popupWindow.webContents && typeof popupWindow.webContents.on === "function") {
      popupWindow.webContents.on("before-input-event", onEscape);
      this.cleanupFns.push(() =>
        popupWindow.webContents.off &&
        popupWindow.webContents.off("before-input-event", onEscape),
      );
    }

    if (typeof popupWindow.on === "function") {
      popupWindow.on("closed", onClosed);
      this.cleanupFns.push(() => popupWindow.off && popupWindow.off("closed", onClosed));
    }

    if (isLiveWindow(parentWindow) && typeof parentWindow.on === "function") {
      for (const eventName of ["resize", "maximize", "unmaximize"]) {
        parentWindow.on(eventName, onResize);
        this.cleanupFns.push(() =>
          parentWindow.off && parentWindow.off(eventName, onResize),
        );
      }
    }
  }

  centerPopup() {
    const parentWindow = this.getParentWindow ? this.getParentWindow() : null;
    if (!isLiveWindow(parentWindow) || !isLiveWindow(this.popupWindow)) {
      return false;
    }

    const parentBounds =
      typeof parentWindow.getBounds === "function" ? parentWindow.getBounds() : null;
    const popupBounds =
      typeof this.popupWindow.getBounds === "function"
        ? this.popupWindow.getBounds()
        : null;
    const nextBounds = centerBounds(parentBounds, popupBounds);

    if (typeof this.popupWindow.setBounds === "function") {
      this.popupWindow.setBounds(nextBounds);
      if (typeof this.popupWindow.show === "function") {
        this.popupWindow.show();
      }
      return true;
    }

    return false;
  }

  close({ restoreFocus = true } = {}) {
    const popup = this.popup;
    const popupWindow = this.popupWindow;
    this.releasePopup({ restoreFocus });

    if (popup && typeof popup.destroy === "function" && !popup.isDestroyed?.()) {
      popup.destroy();
      return true;
    }

    if (isLiveWindow(popupWindow) && typeof popupWindow.close === "function") {
      popupWindow.close();
      return true;
    }

    return false;
  }

  releasePopup({ restoreFocus = true } = {}) {
    const cleanupFns = this.cleanupFns.splice(0, this.cleanupFns.length);
    for (const cleanup of cleanupFns) {
      try {
        cleanup();
      } catch {
        // Cleanup is best-effort; stale Electron listeners are harmless here.
      }
    }
    this.popup = null;
    this.popupWindow = null;

    if (restoreFocus && typeof this.focusActiveEditorSurface === "function") {
      this.focusActiveEditorSurface({ preventScroll: true });
    }
  }
}

function createPasswordManagerOverlayController(options = {}) {
  return new PasswordManagerOverlayController(options);
}

module.exports = {
  PasswordManagerOverlayController,
  createPasswordManagerOverlayController,
  centerBounds,
};

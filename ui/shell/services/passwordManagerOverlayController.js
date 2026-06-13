const { DEFAULT_THEME } = require("../../theme");

const DEFAULT_POPUP_WIDTH = 420;
const DEFAULT_POPUP_HEIGHT = 560;
const POPUP_COVER_FALLBACK_MS = 1800;
const POPUP_COVER_ID = "noctra-password-manager-popup-cover";

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
    getTheme,
    focusActiveEditorSurface,
    markSurfaceRole,
    extensionRole,
  } = {}) {
    this.getParentWindow = getParentWindow;
    this.getTheme = getTheme;
    this.focusActiveEditorSurface = focusActiveEditorSurface;
    this.markSurfaceRole = markSurfaceRole;
    this.extensionRole = extensionRole;
    this.popup = null;
    this.popupWindow = null;
    this.cleanupFns = [];
    this.centerTimers = new Set();
    this.revealTimers = new Set();
    this.popupWindowRevealed = false;
    this.popupContentRevealed = false;
    this.popupBackgroundColor = DEFAULT_THEME.elevatedBackground;
  }

  handlePopupCreated(popup) {
    this.close({ restoreFocus: false });
    const popupWindow = getPopupWindow(popup);
    if (!popupWindow) {
      return false;
    }

    this.popup = popup;
    this.popupWindow = popupWindow;
    this.popupWindowRevealed = false;
    this.popupContentRevealed = false;
    this.popupBackgroundColor = this.resolvePopupBackgroundColor();
    this.preparePopupForReveal(popupWindow);
    this.markExtensionSurface(popupWindow);
    this.bindPopup(popup, popupWindow);
    this.centerPopup();
    this.scheduleCenterPopup(0);
    this.scheduleCenterPopup(120);
    this.scheduleCoverFallback(POPUP_COVER_FALLBACK_MS);
    return true;
  }

  resolvePopupBackgroundColor() {
    const theme = typeof this.getTheme === "function" ? this.getTheme() : null;
    if (
      theme &&
      typeof theme.elevatedBackground === "string" &&
      theme.elevatedBackground.trim().length > 0
    ) {
      return theme.elevatedBackground.trim();
    }
    if (
      theme &&
      typeof theme.shellBackground === "string" &&
      theme.shellBackground.trim().length > 0
    ) {
      return theme.shellBackground.trim();
    }
    return DEFAULT_THEME.elevatedBackground;
  }

  preparePopupForReveal(popupWindow) {
    if (!isLiveWindow(popupWindow)) {
      return;
    }
    if (typeof popupWindow.setBackgroundColor === "function") {
      popupWindow.setBackgroundColor(this.popupBackgroundColor);
    }
    if (typeof popupWindow.setOpacity === "function") {
      popupWindow.setOpacity(0);
    }
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
    const onMoveOrResize = () => this.centerPopup();
    const onDelayedCenter = () => {
      this.centerPopup();
      this.scheduleCenterPopup(80);
    };
    const onContentReady = () => {
      onDelayedCenter();
      this.revealWhenContentPaints(popupWindow);
    };

    if (popup && typeof popup.on === "function") {
      for (const eventName of ["moved", "resized"]) {
        popup.on(eventName, onMoveOrResize);
        this.cleanupFns.push(() =>
          popup.off && popup.off(eventName, onMoveOrResize),
        );
      }
    }

    if (popupWindow.webContents && typeof popupWindow.webContents.on === "function") {
      popupWindow.webContents.on("before-input-event", onEscape);
      this.cleanupFns.push(() =>
        popupWindow.webContents.off &&
        popupWindow.webContents.off("before-input-event", onEscape),
      );
      for (const eventName of ["dom-ready", "did-finish-load"]) {
        popupWindow.webContents.on(eventName, onContentReady);
        this.cleanupFns.push(() =>
          popupWindow.webContents.off &&
          popupWindow.webContents.off(eventName, onContentReady),
        );
      }
    }

    if (typeof popupWindow.on === "function") {
      popupWindow.on("closed", onClosed);
      this.cleanupFns.push(() => popupWindow.off && popupWindow.off("closed", onClosed));
      popupWindow.on("ready-to-show", onDelayedCenter);
      popupWindow.on("show", onDelayedCenter);
      this.cleanupFns.push(() => {
        if (popupWindow.off) {
          popupWindow.off("ready-to-show", onDelayedCenter);
          popupWindow.off("show", onDelayedCenter);
        }
      });
    }

    if (isLiveWindow(parentWindow) && typeof parentWindow.on === "function") {
      for (const eventName of ["resize", "maximize", "unmaximize"]) {
        parentWindow.on(eventName, onMoveOrResize);
        this.cleanupFns.push(() =>
          parentWindow.off && parentWindow.off(eventName, onMoveOrResize),
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
      typeof parentWindow.getContentBounds === "function"
        ? parentWindow.getContentBounds()
        : typeof parentWindow.getBounds === "function"
          ? parentWindow.getBounds()
          : null;
    const popupBounds =
      typeof this.popupWindow.getBounds === "function"
        ? this.popupWindow.getBounds()
        : null;
    const nextBounds = centerBounds(parentBounds, popupBounds);

    if (typeof this.popupWindow.setBounds === "function") {
      this.popupWindow.setBounds(nextBounds);
      return true;
    }

    return false;
  }

  revealWhenContentPaints(popupWindow) {
    if (this.popupContentRevealed || !isLiveWindow(popupWindow)) {
      return;
    }
    const webContents = popupWindow.webContents;
    if (!webContents || typeof webContents.executeJavaScript !== "function") {
      this.revealPopupWindow(popupWindow);
      return;
    }

    this.installPopupCover(popupWindow)
      .then(() => this.revealPopupWindow(popupWindow))
      .then(() => this.waitForPopupVisualReadiness(popupWindow))
      .then((ready) => {
        if (ready) {
          this.revealPopupContent(popupWindow);
        }
      })
      .catch(() => {});
  }

  installPopupCover(popupWindow) {
    const webContents = popupWindow && popupWindow.webContents;
    if (!webContents || typeof webContents.executeJavaScript !== "function") {
      return Promise.resolve(false);
    }
    const color = JSON.stringify(this.popupBackgroundColor);
    const coverId = JSON.stringify(POPUP_COVER_ID);

    return webContents.executeJavaScript(
      `(() => {
        const id = ${coverId};
        const color = ${color};
        let cover = document.getElementById(id);
        if (!cover) {
          cover = document.createElement('div');
          cover.id = id;
          cover.setAttribute('aria-hidden', 'true');
          document.documentElement.appendChild(cover);
        }
        Object.assign(cover.style, {
          position: 'fixed',
          inset: '0',
          zIndex: '2147483647',
          pointerEvents: 'none',
          background: color,
          opacity: '1',
          transition: 'opacity 80ms linear',
        });
        return true;
      })();`,
    );
  }

  waitForPopupVisualReadiness(popupWindow) {
    const webContents = popupWindow && popupWindow.webContents;
    if (!webContents || typeof webContents.executeJavaScript !== "function") {
      return Promise.resolve(true);
    }

    return webContents.executeJavaScript(
      `(() => new Promise((resolve) => {
          const coverId = ${JSON.stringify(POPUP_COVER_ID)};
          const isBlankColor = (value) => {
            const color = String(value || '').replace(/\\s+/g, '').toLowerCase();
            return color === 'transparent' || color === 'rgba(0,0,0,0)' || color === 'rgb(255,255,255)' || color === '#fff' || color === '#ffffff';
          };
          const hasVisibleContent = () => {
            const body = document.body;
            if (!body) return false;
            const bodyRect = body.getBoundingClientRect();
            if (bodyRect.width <= 0 || bodyRect.height <= 0) return false;
            const candidates = Array.from(body.querySelectorAll('*')).filter((element) => element.id !== coverId).slice(0, 120);
            return candidates.some((element) => {
              const style = window.getComputedStyle(element);
              if (!style || style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) return false;
              const rect = element.getBoundingClientRect();
              if (rect.width <= 1 || rect.height <= 1) return false;
              const tagName = String(element.tagName || '').toLowerCase();
              const hasText = Boolean(String(element.textContent || '').trim()) && !isBlankColor(style.color);
              const isControl = ['button', 'input', 'select', 'textarea', 'svg', 'img'].includes(tagName) || element.getAttribute('role') === 'button';
              const hasRealPaint = !isBlankColor(style.backgroundColor) || style.backgroundImage !== 'none' || style.boxShadow !== 'none';
              return hasText || isControl || hasRealPaint;
            });
          };
          const waitForFonts = () => {
            if (!document.fonts || !document.fonts.ready) return Promise.resolve();
            return Promise.race([
              document.fonts.ready.catch(() => {}),
              new Promise((resolveFonts) => setTimeout(resolveFonts, 220)),
            ]);
          };
          const waitForStableLayout = (remaining = 5, previous = null, stable = 0) => {
            requestAnimationFrame(() => {
              const body = document.body;
              const rect = body ? body.getBoundingClientRect() : { width: 0, height: 0 };
              const next = [Math.round(rect.width), Math.round(rect.height), document.body ? document.body.scrollHeight : 0].join(':');
              const nextStable = previous === next ? stable + 1 : 0;
              if (nextStable >= 2 || remaining <= 0) {
                resolve(hasVisibleContent());
                return;
              }
              waitForStableLayout(remaining - 1, next, nextStable);
            });
          };
          const finishIfReady = () => {
            if (!hasVisibleContent()) return false;
            waitForFonts().then(() => waitForStableLayout());
            return true;
          };
          if (finishIfReady()) {
            return;
          }
          const timeout = setTimeout(() => {
            if (observer) observer.disconnect();
            if (!finishIfReady()) resolve(false);
          }, 320);
          const observer = new MutationObserver(() => {
            if (!hasVisibleContent()) return;
            clearTimeout(timeout);
            observer.disconnect();
            waitForFonts().then(() => waitForStableLayout());
          });
          observer.observe(document.documentElement || document, { childList: true, subtree: true, characterData: true, attributes: true });
        }))();`,
    );
  }

  revealPopupWindow(popupWindow = this.popupWindow) {
    if (this.popupWindowRevealed || !isLiveWindow(popupWindow)) {
      return false;
    }
    this.popupWindowRevealed = true;
    this.centerPopup();
    if (typeof popupWindow.setOpacity === "function") {
      popupWindow.setOpacity(1);
    }
    return true;
  }

  revealPopupContent(popupWindow = this.popupWindow) {
    if (this.popupContentRevealed || !isLiveWindow(popupWindow)) {
      return Promise.resolve(false);
    }
    this.popupContentRevealed = true;
    for (const timer of this.revealTimers) {
      clearTimeout(timer);
    }
    this.revealTimers.clear();
    this.revealPopupWindow(popupWindow);
    const webContents = popupWindow.webContents;
    if (!webContents || typeof webContents.executeJavaScript !== "function") {
      return Promise.resolve(true);
    }
    return webContents
      .executeJavaScript(
        `(() => {
          const cover = document.getElementById(${JSON.stringify(POPUP_COVER_ID)});
          if (!cover) return false;
          cover.style.opacity = '0';
          setTimeout(() => cover.remove(), 100);
          return true;
        })();`,
      )
      .then(() => true)
      .catch(() => false);
  }

  scheduleCoverFallback(delayMs) {
    const timer = setTimeout(() => {
      this.revealTimers.delete(timer);
      this.revealPopupContent();
    }, delayMs);
    timer.unref?.();
    this.revealTimers.add(timer);
  }

  scheduleRevealFallback(delayMs) {
    this.scheduleCoverFallback(delayMs);
  }

  scheduleCenterPopup(delayMs) {
    const timer = setTimeout(() => {
      this.centerTimers.delete(timer);
      this.centerPopup();
    }, delayMs);
    timer.unref?.();
    this.centerTimers.add(timer);
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
    for (const timer of this.centerTimers) {
      clearTimeout(timer);
    }
    this.centerTimers.clear();
    for (const timer of this.revealTimers) {
      clearTimeout(timer);
    }
    this.revealTimers.clear();
    for (const cleanup of cleanupFns) {
      try {
        cleanup();
      } catch {
        // Cleanup is best-effort; stale Electron listeners are harmless here.
      }
    }
    this.popup = null;
    this.popupWindow = null;
    this.popupWindowRevealed = false;
    this.popupContentRevealed = false;
    this.popupBackgroundColor = DEFAULT_THEME.elevatedBackground;

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

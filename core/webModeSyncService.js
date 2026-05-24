function isUsableWebContents(webContents) {
  return Boolean(webContents && !webContents.isDestroyed());
}

function createWebModeSyncService({
  syncWebModeWithFocusedElement,
  bindWebModeTracking,
}) {
  if (typeof syncWebModeWithFocusedElement !== "function") {
    throw new Error(
      "createWebModeSyncService requires syncWebModeWithFocusedElement",
    );
  }
  if (typeof bindWebModeTracking !== "function") {
    throw new Error("createWebModeSyncService requires bindWebModeTracking");
  }

  let activeWebContents = null;
  let unbindListeners = null;
  let syncTimer = null;
  let syncInFlight = false;
  let syncPending = false;

  function clearPendingSync() {
    if (!syncTimer) {
      return;
    }
    clearTimeout(syncTimer);
    syncTimer = null;
  }

  function requestSync(webContents, options = {}) {
    const delayMs =
      typeof options === "number"
        ? options
        : Math.max(0, Number(options.delayMs) || 0);
    const reason =
      options && typeof options === "object" && typeof options.reason === "string"
        ? options.reason
        : "focus-change";

    if (
      !isUsableWebContents(webContents) ||
      activeWebContents !== webContents
    ) {
      return;
    }

    clearPendingSync();

    syncTimer = setTimeout(
      () => {
        syncTimer = null;

        if (
          !isUsableWebContents(webContents) ||
          activeWebContents !== webContents
        ) {
          return;
        }

        if (syncInFlight) {
          syncPending = true;
          return;
        }

        syncInFlight = true;
        Promise.resolve(syncWebModeWithFocusedElement(webContents, { reason })).finally(
          () => {
            syncInFlight = false;
            if (!syncPending) {
              return;
            }
            syncPending = false;
            requestSync(webContents, { delayMs: 30, reason: "sync-pending" });
          },
        );
      },
      delayMs,
    );
  }

  function syncNowIfTracked(webContents, options = {}) {
    const reason =
      options && typeof options === "object" && typeof options.reason === "string"
        ? options.reason
        : "focus-change";
    if (
      !isUsableWebContents(webContents) ||
      activeWebContents !== webContents
    ) {
      return Promise.resolve();
    }
    return Promise.resolve(syncWebModeWithFocusedElement(webContents, { reason }));
  }

  function unbind() {
    if (typeof unbindListeners === "function") {
      unbindListeners();
    }
    unbindListeners = null;
    activeWebContents = null;
    clearPendingSync();
    syncInFlight = false;
    syncPending = false;
  }

  function bind(webContents) {
    if (!isUsableWebContents(webContents)) {
      return;
    }

    unbind();

    activeWebContents = webContents;
    unbindListeners = bindWebModeTracking(webContents, {
      onFocusChangedInPage() {
        requestSync(webContents, { delayMs: 40, reason: "focus-change" });
      },
      onBeforeMouseEvent(_event, input) {
        if (
          !input ||
          (input.type !== "mouseDown" && input.type !== "mouseUp")
        ) {
          return;
        }
        requestSync(webContents, {
          delayMs: input.type === "mouseDown" ? 10 : 35,
          reason: "mouse-event",
        });
      },
      onDidFinishLoad() {
        requestSync(webContents, { delayMs: 20, reason: "did-finish-load" });
      },
      onDidStartNavigation(_event, _url, _isInPlace, isMainFrame) {
        if (isMainFrame === false) {
          return;
        }
        requestSync(webContents, {
          delayMs: 0,
          reason: "did-start-navigation",
        });
      },
      onDidNavigate(_event, _url, _httpResponseCode, _httpStatusText) {
        requestSync(webContents, {
          delayMs: 0,
          reason: "did-navigate",
        });
      },
      onDidNavigateInPage(_event, _url, isMainFrame) {
        if (isMainFrame === false) {
          return;
        }
        requestSync(webContents, {
          delayMs: 0,
          reason: "did-navigate-in-page",
        });
      },
    });

    requestSync(webContents, { delayMs: 0, reason: "bind" });
  }

  function getActiveWebContents() {
    return activeWebContents;
  }

  return {
    bind,
    unbind,
    requestSync,
    syncNowIfTracked,
    getActiveWebContents,
  };
}

module.exports = {
  createWebModeSyncService,
};

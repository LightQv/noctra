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

  function requestSync(webContents, delayMs = 40) {
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
        Promise.resolve(syncWebModeWithFocusedElement(webContents)).finally(
          () => {
            syncInFlight = false;
            if (!syncPending) {
              return;
            }
            syncPending = false;
            requestSync(webContents, 30);
          },
        );
      },
      Math.max(0, Number(delayMs) || 0),
    );
  }

  function syncNowIfTracked(webContents) {
    if (
      !isUsableWebContents(webContents) ||
      activeWebContents !== webContents
    ) {
      return Promise.resolve();
    }
    return Promise.resolve(syncWebModeWithFocusedElement(webContents));
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
        requestSync(webContents);
      },
      onBeforeMouseEvent(_event, input) {
        if (
          !input ||
          (input.type !== "mouseDown" && input.type !== "mouseUp")
        ) {
          return;
        }
        requestSync(webContents, input.type === "mouseDown" ? 10 : 35);
      },
      onDidFinishLoad() {
        requestSync(webContents, 20);
      },
    });

    requestSync(webContents, 0);
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

function wireWindowLifecycle({
  win,
  uiShell,
  buffers,
  sidepanelController,
  updateUrllineRender,
  updateLoadinglineRender,
  configService,
  persistSessionSnapshot,
  webContentsActions,
}) {
  const syncWindowChrome = () => {
    uiShell.setWindowChrome({
      isMaximized: win.isMaximized(),
      isFullScreen: win.isFullScreen(),
    });
    updateUrllineRender();
    updateLoadinglineRender();
  };

  win.on("maximize", syncWindowChrome);
  win.on("unmaximize", syncWindowChrome);
  win.on("enter-full-screen", syncWindowChrome);
  win.on("leave-full-screen", syncWindowChrome);

  let persistWindowBoundsTimer = null;
  const persistWindowBoundsDebounced = () => {
    if (persistWindowBoundsTimer) {
      clearTimeout(persistWindowBoundsTimer);
    }
    persistWindowBoundsTimer = setTimeout(() => {
      if (
        !win ||
        win.isDestroyed() ||
        win.isMaximized() ||
        win.isFullScreen()
      ) {
        return;
      }
      const { width, height, x, y } = win.getBounds();
      configService.updateWindowState({ width, height, x, y });
    }, 300);
  };

  const flushWindowBoundsPersistence = () => {
    if (persistWindowBoundsTimer) {
      clearTimeout(persistWindowBoundsTimer);
      persistWindowBoundsTimer = null;
    }
    if (!win || win.isDestroyed() || win.isMaximized() || win.isFullScreen()) {
      return;
    }
    const { width, height, x, y } = win.getBounds();
    configService.updateWindowState({ width, height, x, y });
  };

  const persistWindowMaximizedState = (isMaximized) => {
    configService.updateWindowState({ is_maximized: Boolean(isMaximized) });
  };

  win.on("maximize", () => {
    persistWindowMaximizedState(true);
  });

  win.on("unmaximize", () => {
    persistWindowMaximizedState(false);
    persistWindowBoundsDebounced();
  });

  win.on("resize", () => {
    sidepanelController.layout();
    uiShell.updateSplitDivider(buffers.getSplitStatus());
    updateUrllineRender();
    updateLoadinglineRender();
    persistWindowBoundsDebounced();
  });

  win.on("move", () => {
    persistWindowBoundsDebounced();
  });

  let statusPollInFlight = false;
  let requestedStatusPollTimer = null;

  const readActiveScrollPercent = () => {
    if (!win || win.isDestroyed()) {
      return;
    }
    if (typeof win.isFocused === "function" && !win.isFocused()) {
      return;
    }
    if (typeof win.isMinimized === "function" && win.isMinimized()) {
      return;
    }

    const activeBuffer = buffers.getActive();
    if (!activeBuffer) {
      return;
    }

    const activeWebContents = activeBuffer.webContents;
    if (
      !activeWebContents ||
      activeWebContents.isDestroyed() ||
      activeWebContents.isLoading() ||
      activeWebContents.isLoadingMainFrame() ||
      statusPollInFlight
    ) {
      return;
    }

    statusPollInFlight = true;

    webContentsActions
      .readScrollPercent(activeWebContents)
      .then((percent) => {
        if (typeof percent === "number") {
          uiShell.updateStatuslineScroll(percent);
        }
      })
      .catch(() => {})
      .finally(() => {
        statusPollInFlight = false;
      });
  };

  const requestScrollStatusUpdate = (delayMs = 16) => {
    if (requestedStatusPollTimer) {
      clearTimeout(requestedStatusPollTimer);
    }

    requestedStatusPollTimer = setTimeout(() => {
      requestedStatusPollTimer = null;
      readActiveScrollPercent();
    }, Math.max(0, Number(delayMs) || 0));
  };

  const statusPoller = setInterval(() => {
    readActiveScrollPercent();
  }, 900);

  win.on("close", () => {
    persistSessionSnapshot();
    flushWindowBoundsPersistence();
  });

  win.on("closed", () => {
    if (persistWindowBoundsTimer) {
      clearTimeout(persistWindowBoundsTimer);
      persistWindowBoundsTimer = null;
    }
    if (requestedStatusPollTimer) {
      clearTimeout(requestedStatusPollTimer);
      requestedStatusPollTimer = null;
    }
    clearInterval(statusPoller);
  });

  return {
    requestScrollStatusUpdate,
  };
}

module.exports = {
  wireWindowLifecycle,
};

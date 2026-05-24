function bootstrapWindowRuntime({
  BrowserWindow,
  path,
  process,
  fs,
  ipcMain,
  nativeTheme,
  screen,
  app,
  state,
  buffers,
  uiShell,
  sidepanelController,
  historyService,
  notificationsService,
  configService,
  dispatch,
  INTENTS,
  webContentsActions,
  registerRuntimeIpc,
  registerIpcContracts,
  createSmokeScenarios,
  inputCoordinator,
  handleRawInput,
  handleMouseInput,
  isEditorFocused,
  wireWindowLifecycle,
  getSurfaceRole,
  isAllowedTrustedSurfaceUrl,
  SURFACE_ROLES,
  markSurfaceRole,
  performWindowAction,
  setEditorFocused,
  enterCommandMode,
  focusActiveEditorSurface,
  getStatuslineModeLabel,
  startUrllineEdit,
  resolveCurrentTheme,
  buildThemePayload,
  applyReloadedConfig,
  applyTheme,
  updateTablineActions,
  updateTablineOptions,
  updateUrllineActions,
  updateUrllineRender,
  updateLoadinglineRender,
  stopUrllineEdit,
  normalizeHistoryUrl,
  applyBrowserLanguagePreference,
  persistSessionSnapshot,
}) {
  const DEFAULT_CASCADE_OFFSET_PX = 28;

  function isFiniteInteger(value) {
    return Number.isFinite(value) && Number.isInteger(value);
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function resolveCascadePosition({ x, y, width, height, workArea, offsetPx }) {
    if (!workArea) {
      return { x, y };
    }

    const maxX = workArea.x + Math.max(0, workArea.width - width);
    const maxY = workArea.y + Math.max(0, workArea.height - height);
    const minX = workArea.x;
    const minY = workArea.y;

    let nextX = x + offsetPx;
    let nextY = y + offsetPx;

    if (nextX > maxX || nextY > maxY) {
      nextX = minX + offsetPx;
      nextY = minY + offsetPx;
    }

    return {
      x: clamp(nextX, minX, maxX),
      y: clamp(nextY, minY, maxY),
    };
  }

  function isBoundsVisibleOnAnyDisplay(bounds) {
    if (
      !bounds ||
      !Number.isFinite(bounds.width) ||
      !Number.isFinite(bounds.height)
    ) {
      return false;
    }

    const displays = screen.getAllDisplays();
    return displays.some((display) => {
      const area = display.workArea;
      const intersectsHorizontally =
        bounds.x < area.x + area.width && bounds.x + bounds.width > area.x;
      const intersectsVertically =
        bounds.y < area.y + area.height && bounds.y + bounds.height > area.y;
      return intersectsHorizontally && intersectsVertically;
    });
  }

  const config = configService.initConfig();
  state.applyConfig(config);
  applyBrowserLanguagePreference();
  const initialWidth = configService.getConfigValue(
    "global.window.width",
    1200,
  );
  const initialHeight = configService.getConfigValue(
    "global.window.height",
    800,
  );
  const initialX = configService.getConfigValue("global.window.x", null);
  const initialY = configService.getConfigValue("global.window.y", null);
  const initialIsMaximized = configService.getConfigValue(
    "global.window.is_maximized",
    false,
  );
  const cascadeOffsetPx = Math.max(
    0,
    Math.floor(
      configService.getConfigValue(
        "global.window.cascade_offset_px",
        DEFAULT_CASCADE_OFFSET_PX,
      ),
    ),
  );

  const isMac = process.platform === "darwin";

  const windowOptions = {
    width: initialWidth,
    height: initialHeight,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      preload: path.join(__dirname, "..", "ui", "shell", "preload.js"),
    },
  };

  if (isMac) {
    windowOptions.titleBarStyle = "hiddenInset";
  } else {
    windowOptions.frame = false;
  }

  const hasConfiguredPosition =
    isFiniteInteger(initialX) && isFiniteInteger(initialY);
  const existingWindows =
    BrowserWindow && typeof BrowserWindow.getAllWindows === "function"
      ? BrowserWindow.getAllWindows().filter((windowRef) => {
          return windowRef && !windowRef.isDestroyed();
        })
      : [];

  if (existingWindows.length > 0) {
    const focusedWindow = existingWindows.find((windowRef) => windowRef.isFocused());
    const sourceWindow = focusedWindow || existingWindows[existingWindows.length - 1];

    let sourceBounds = sourceWindow.getBounds();
    if (
      (sourceWindow.isMaximized() || sourceWindow.isFullScreen()) &&
      typeof sourceWindow.getNormalBounds === "function"
    ) {
      sourceBounds = sourceWindow.getNormalBounds();
    }

    const sourceDisplay = screen.getDisplayMatching(sourceBounds);
    const cascadePosition = resolveCascadePosition({
      x: sourceBounds.x,
      y: sourceBounds.y,
      width: initialWidth,
      height: initialHeight,
      workArea: sourceDisplay ? sourceDisplay.workArea : null,
      offsetPx: cascadeOffsetPx,
    });
    windowOptions.x = cascadePosition.x;
    windowOptions.y = cascadePosition.y;
  } else if (hasConfiguredPosition) {
    const candidateBounds = {
      x: initialX,
      y: initialY,
      width: initialWidth,
      height: initialHeight,
    };
    if (isBoundsVisibleOnAnyDisplay(candidateBounds)) {
      windowOptions.x = initialX;
      windowOptions.y = initialY;
    }
  }

  const win = new BrowserWindow(windowOptions);
  markSurfaceRole(win.webContents, SURFACE_ROLES.TRUSTED_SHELL);

  win.setMaxListeners(0);

  win.webContents.on("before-input-event", (event, input) => {
    handleRawInput(event, input);
  });
  win.webContents.on("before-mouse-event", (event, input) => {
    if (typeof handleMouseInput === "function") {
      handleMouseInput(event, input);
    }
  });

  win.webContents.on("did-finish-load", () => {
    buffers.focusActive();
  });

  registerRuntimeIpc({
    win,
    fs,
    ipcMain,
    state,
    buffers,
    dispatch,
    INTENTS,
    uiShell,
    sidepanelController,
    webContentsActions,
    getSurfaceRole,
    isAllowedTrustedSurfaceUrl,
    SURFACE_ROLES,
    performWindowAction,
    setEditorFocused,
    enterCommandMode,
    focusActiveEditorSurface,
    getStatuslineModeLabel,
    startUrllineEdit,
    configService,
    resolveCurrentTheme,
    buildThemePayload,
    applyReloadedConfig,
    registerIpcContracts,
    notificationsService,
  });

  buffers.init(win);
  buffers.setUrllineVisible(
    configService.getConfigValue("global.ui.urlline.enabled", false),
  );
  buffers.setLoadinglineVisible(
    configService.getConfigValue("global.ui.loadingline.enabled", true),
  );
  uiShell.init(win);
  const sidepanelViewHost = uiShell.initializeSidepanelSurface({
    onMouseDown: () => {
      sidepanelController.focus();
    },
    onMouseEvent: (input) => {
      sidepanelController.handleMouseEvent(input);
    },
    onFocus: () => {
      sidepanelController.focus();
    },
  });
  sidepanelController.init({
    window: win,
    buffers,
    state,
    viewHost: sidepanelViewHost,
  });
  sidepanelController.setOnFocusChange(() => {
    uiShell.updateStatuslineMode(getStatuslineModeLabel());
    updateTablineOptions();
  });
  sidepanelController.setWidthRatio(
    configService.getConfigValue("global.ui.sidepanel.width_ratio", 0.2),
  );
  sidepanelController.setTreeScrollContextLines(
    configService.getConfigValue(
      "global.ui.sidepanel.tree_scroll_context_lines",
      3,
    ),
  );
  sidepanelController.setTreeDeleteOperatorTimeoutMs(
    configService.getConfigValue(
      "global.ui.sidepanel.delete_operator_timeout_ms",
      900,
    ),
  );
  const sidepanelWebContents = uiShell.getSidepanelWebContents();
  if (sidepanelWebContents) {
    sidepanelWebContents.on("before-input-event", (event, input) => {
      handleRawInput(event, input);
    });
    sidepanelWebContents.on("before-mouse-event", (event, input) => {
      if (typeof handleMouseInput === "function") {
        handleMouseInput(event, input);
      }
    });
  }
  const smokeScenarios = createSmokeScenarios({
    app,
    win,
    fs,
    state,
    buffers,
    dispatch,
    INTENTS,
    configService,
    sidepanelController,
    uiShell,
    webContentsActions,
    isEditorFocused,
    getStatuslineModeLabel,
    updateTablineOptions,
    updateUrllineRender,
  });
  smokeScenarios.setupSmokeUiCadenceProbe();
  notificationsService.setToastHandler((toast) => {
    uiShell.showNotificationToast(toast);
  });
  applyTheme(resolveCurrentTheme());
  uiShell.setWindowChrome({
    platform: process.platform,
    useNativeControls: isMac,
    isMaximized: win.isMaximized(),
    isFullScreen: win.isFullScreen(),
  });
  uiShell.updateStatuslineMode(getStatuslineModeLabel());
  uiShell.updateStatuslineScroll(0);
  uiShell.updateStatuslineSplitIndicator(buffers.getSplitStatus());
  uiShell.updateSplitDivider(buffers.getSplitStatus());
  updateTablineActions();
  updateTablineOptions();
  updateUrllineActions();
  updateUrllineRender();
  updateLoadinglineRender();

  wireWindowLifecycle({
    win,
    uiShell,
    buffers,
    sidepanelController,
    updateUrllineRender,
    updateLoadinglineRender,
    configService,
    persistSessionSnapshot,
    webContentsActions,
    state,
  });

  if (initialIsMaximized) {
    win.maximize();
  }

  let lastRecordedVisit = {
    url: "",
    atMs: 0,
  };

  buffers.subscribe((snapshot, active, change = {}) => {
    if (!active) return;

    const activeChanged = Boolean(change.activeChanged);

    uiShell.renderTabline(snapshot);
    const urllineModel = buffers.getUrllineRenderModel();
    if (state.urllineEditing) {
      const editingPane = state.urllinePane === "right" ? "right" : "left";
      const paneStillVisible = Array.isArray(urllineModel.panes)
        ? urllineModel.panes.some((pane) => pane && pane.pane === editingPane)
        : false;
      if (!paneStillVisible) {
        stopUrllineEdit();
      }
    }
    updateUrllineRender();
    updateLoadinglineRender();
    uiShell.updateStatuslineMode(getStatuslineModeLabel());
    uiShell.updateStatuslineSplitIndicator(buffers.getSplitStatus());
    uiShell.updateSplitDivider(buffers.getSplitStatus());

    if (
      activeChanged ||
      inputCoordinator.getActiveInputWebContents() !== active.webContents
    ) {
      inputCoordinator.bindInputToActiveBuffer();
    }

    if (change.activeChanged) {
      uiShell.syncOverlayStack();
    } else if (uiShell.isCommandVisible()) {
      uiShell.keepCommandOverlayAboveContentViews();
    }

    if (change.kind === "pane-interaction" && sidepanelController.isFocused()) {
      sidepanelController.unfocus();
      updateTablineOptions();
      uiShell.updateStatuslineMode(getStatuslineModeLabel());
    }

    if (change.kind === "visit" && change.url) {
      const normalizedUrl = normalizeHistoryUrl(change.url);
      if (!normalizedUrl) {
        return;
      }

      const nowMs = Number.isFinite(change.timestampMs)
        ? change.timestampMs
        : Date.now();
      if (
        lastRecordedVisit.url === normalizedUrl &&
        nowMs - lastRecordedVisit.atMs <= 1200
      ) {
        return;
      }

      lastRecordedVisit = {
        url: normalizedUrl,
        atMs: nowMs,
      };

      historyService.recordVisit({
        url: normalizedUrl,
        title: change.title,
        timestampMs: nowMs,
      });
      if (sidepanelController.isVisible()) {
        sidepanelController.reloadData();
        sidepanelController.render();
      }
    }

    if (change.kind === "title-updated" && change.url && change.title) {
      const normalizedUrl = normalizeHistoryUrl(change.url);
      if (!normalizedUrl) {
        return;
      }
      historyService.updateLatestTitleForUrl(normalizedUrl, change.title);
      if (sidepanelController.isVisible()) {
        sidepanelController.reloadData();
        sidepanelController.render();
      }
    }
  });

  buffers.openConfiguredBuffer();
  inputCoordinator.bindInputToActiveBuffer();
  win.on("closed", () => {
    inputCoordinator.dispose();
  });

  const onNativeThemeUpdated = () => {
    const themeContext = resolveCurrentTheme();
    const uiFollowsSystem =
      themeContext.configuredMode === "auto" ||
      (themeContext.configuredMode === "custom" &&
        themeContext.customBase === "auto");
    const shouldApplyFromSystem =
      uiFollowsSystem ||
      themeContext.contentMode === "auto" ||
      (themeContext.contentMode === "match" && uiFollowsSystem);
    if (!shouldApplyFromSystem) {
      return;
    }

    applyTheme(themeContext, { broadcast: true });
    updateTablineActions();
    updateTablineOptions();
    updateUrllineActions();
    updateUrllineRender();
    updateLoadinglineRender();
  };

  nativeTheme.on("updated", onNativeThemeUpdated);

  win.on("closed", () => {
    nativeTheme.removeListener("updated", onNativeThemeUpdated);
  });

  return { win, smokeScenarios };
}

module.exports = {
  bootstrapWindowRuntime,
};

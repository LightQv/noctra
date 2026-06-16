const path = require("path");
const fs = require("fs");
const os = require("os");
const { execFile } = require("child_process");
const { promisify } = require("util");
const {
  app,
  BrowserWindow,
  ipcMain,
  clipboard,
  nativeTheme,
  nativeImage,
  screen,
  session,
  dialog,
} = require("electron");
const { createBufferManager } = require("./browser/manager");
const { createInputHandler } = require("./core/input");
const { createState } = require("./core/state");
require("dotenv").config();

const configService = require("./core/config/service");
const { createUiShellManager } = require("./ui/shell/manager");
const { createDispatcher } = require("./core/dispatcher");
const { INTENTS } = require("./core/intents");
const {
  normalizeThemeMode,
  normalizeContentThemeMode,
  normalizeCustomBase,
  resolveTheme,
  resolveThemeMode,
  resolveContentColorScheme,
  toCssVars,
} = require("./ui/theme");
const { resolveInputTarget } = require("./core/resolver");
const historyService = require("./core/history/service");
const bookmarksService = require("./core/bookmarks/service");
const { createHistoryPanel } = require("./core/history/panel");
const {
  createBookmarkInsertScopeModal,
} = require("./core/bookmarks/insertScopeModal");
const { createDownloadsModal } = require("./core/downloads/modal");
const { createTelescopeService } = require("./core/telescope/service");
const { resolveFocusSnapshot } = require("./core/focusResolver");
const { resolveInputPriority } = require("./core/inputPriorityResolver");
const {
  setMode,
  enterInsertMode,
  enterNormalMode,
  enterCommandMode,
} = require("./core/modeTransitionService");
const {
  setEditorFocused,
  isEditorFocused,
} = require("./core/editorFocusState");
const {
  createStatuslineModeLabelResolver,
} = require("./core/statuslineModeLabel");
const {
  assertInputPipelinePreconditions,
  assertModeWriteBoundary,
} = require("./core/invariants");
const sessionService = require("./core/session/service");
const notificationsService = require("./core/notifications/service");
const { validateNavigableUrl } = require("./core/security/urlPolicy");
const {
  SURFACE_ROLES,
  markSurfaceRole,
  getSurfaceRole,
  isAllowedTrustedSurfaceUrl,
} = require("./core/security/surfaceTrust");
const {
  performWindowAction,
} = require("./core/adapters/platform/windowActions");
const webContentsActions = require("./core/adapters/platform/webContentsActions");
const {
  bindWebModeTracking,
} = require("./core/adapters/platform/webContentsEvents");
const {
  registerSessionSecurityPolicy: registerSessionSecurityPolicyAdapter,
  registerWebContentsSecurityPolicy: registerWebContentsSecurityPolicyAdapter,
} = require("./core/adapters/platform/securityPolicy");
const {
  registerIpcContracts,
} = require("./core/adapters/platform/ipcRegistry");
const editorSurface = require("./core/adapters/renderer/editorSurface");
const {
  broadcastUiShellPush,
} = require("./core/adapters/renderer/uiShellPush");
const { createWebModeSyncService } = require("./core/webModeSyncService");
const { getNormalActionMap, getModActionMap } = require("./motions/keymap");
const { createInputCoordinator } = require("./runtime/inputCoordinator");
const { registerRuntimeIpc } = require("./runtime/ipcRegistration");
const { wireWindowLifecycle } = require("./runtime/windowLifecycle");
const { createSmokeScenarios } = require("./runtime/smokeScenarios");
const { bootstrapWindowRuntime } = require("./runtime/windowBootstrap");
const { registerWebContextMenu } = require("./runtime/contextMenuRegistration");
const {
  createBrowserLanguagePolicy,
} = require("./runtime/browserLanguagePolicy");
const { createThemeRuntime } = require("./runtime/themeRuntime");
const { createUrlPolicyRuntime } = require("./runtime/urlPolicyRuntime");
const { createConfigRuntime } = require("./runtime/configRuntime");
const { createUrllineCoordinator } = require("./runtime/urllineCoordinator");
const {
  registerChromeExtensionPreloads,
} = require("./core/extensions/extensionPreloadRegistration");
const {
  createChromeExtensionRuntime,
} = require("./core/extensions/chromeExtensionRuntime");
const {
  PasswordManagerService,
} = require("./core/extensions/passwordManagerService");
const {
  createChromeWebStoreInstaller,
} = require("./core/extensions/chromeWebStoreInstaller");
const {
  getManagedExtensionIds,
} = require("./core/extensions/managedExtensionRegistry");
const {
  createPasswordManagerOverlayController,
} = require("./ui/shell/services/passwordManagerOverlayController");
const {
  resetLeaderSession,
  resetSequenceBuffers,
} = require("./core/state/leaderState");
const {
  moveUrllineCursor,
  setUrllineCursor,
  startUrllineEditState,
  stopUrllineEditState,
  insertUrllineTextAtCursor,
  deleteUrllineBackward,
  deleteUrllineForward,
} = require("./core/state/urllineState");
const { createAppMenu } = require("./core/adapters/platform/appMenu");
const { openDoc } = require("./core/adapters/platform/openExternal");
const { isBookmarkableBuffer } = require("./core/bookmarks/eligibility");
app.setName("Noctra");
const execFileAsync = promisify(execFile);

function applyUserDataOverride() {
  const userDataDir = process.env.NOCTRA_USER_DATA_DIR;
  if (typeof userDataDir !== "string" || !userDataDir.trim()) {
    return;
  }

  const resolvedUserDataDir = path.resolve(userDataDir.trim());
  fs.mkdirSync(resolvedUserDataDir, { recursive: true });
  app.setPath("userData", resolvedUserDataDir);
}

applyUserDataOverride();

function getExtensionStorePath() {
  return path.join(app.getPath("userData"), "Extensions");
}

let entryIcons = null;
let pendingUrls = [];
const windowContexts = new Map();
let isAppQuitting = false;
let extensionShutdownComplete = false;
let extensionShutdownInFlight = null;

function loadElectronChromeExtensionsClass() {
  try {
    return require("electron-chrome-extensions").ElectronChromeExtensions;
  } catch (error) {
    notificationsService.notify({
      severity: "warning",
      code: "chrome_extension_runtime_unavailable",
      message: "Chrome extension runtime is unavailable.",
      source: "main",
      context: {
        message: error && error.message ? error.message : String(error),
      },
      persist: false,
    });
    return null;
  }
}

function loadElectronChromeWebStore() {
  try {
    return require("electron-chrome-web-store");
  } catch (error) {
    notificationsService.notify({
      severity: "warning",
      code: "chrome_web_store_unavailable",
      message: "Chrome Web Store installer is unavailable.",
      source: "main",
      context: {
        message: error && error.message ? error.message : String(error),
      },
      persist: false,
    });
    return null;
  }
}

function getLastWindowContext() {
  const values = Array.from(windowContexts.values());
  return values.length > 0 ? values[values.length - 1] : null;
}

async function shutdownManagedExtensionsForQuit() {
  if (extensionShutdownComplete) {
    return true;
  }

  if (extensionShutdownInFlight) {
    return extensionShutdownInFlight;
  }

  extensionShutdownInFlight = runManagedExtensionShutdown().finally(() => {
    extensionShutdownInFlight = null;
  });
  return extensionShutdownInFlight;
}

async function runManagedExtensionShutdown() {
  const shutdownTasks = [];
  const seenServices = new Set();

  for (const context of windowContexts.values()) {
    const service = context.passwordManagerService;
    if (
      service &&
      !seenServices.has(service) &&
      typeof service.shutdown === "function"
    ) {
      seenServices.add(service);
      shutdownTasks.push(service.shutdown());
    }
  }

  const extensionsApi = session.defaultSession?.extensions;
  if (extensionsApi && typeof extensionsApi.removeExtension === "function") {
    for (const extensionId of getManagedExtensionIds()) {
      shutdownTasks.push(removeManagedExtensionForQuit(extensionsApi, extensionId));
    }
  }

  await Promise.allSettled(shutdownTasks);
  extensionShutdownComplete = true;
  return true;
}

async function removeManagedExtensionForQuit(extensionsApi, extensionId) {
  if (!extensionId) {
    return false;
  }

  try {
    if (typeof extensionsApi.getExtension === "function") {
      const extension = extensionsApi.getExtension(extensionId);
      if (!extension) {
        return false;
      }
    }
    await extensionsApi.removeExtension(extensionId);
    return true;
  } catch {
    return false;
  }
}

function extractHttpUrlFromArgv(argv = []) {
  for (const arg of argv) {
    if (typeof arg !== "string") continue;
    const value = arg.trim();
    if (!value) continue;
    if (!/^https?:\/\//i.test(value)) continue;
    try {
      const parsed = new URL(value);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.toString();
      }
    } catch {
      // Ignore invalid URL candidate
    }
  }
  return null;
}

async function integrateLinuxAppImage() {
  const homeDir = os.homedir();
  const applicationsDir = path.join(homeDir, ".local", "share", "applications");
  const iconsDir = path.join(
    homeDir,
    ".local",
    "share",
    "icons",
    "hicolor",
    "512x512",
    "apps",
  );

  fs.mkdirSync(applicationsDir, { recursive: true });
  fs.mkdirSync(iconsDir, { recursive: true });

  const darkIconSource = path.join(
    __dirname,
    "assets",
    "icons",
    "icon-dark_512.png",
  );
  const lightIconSource = path.join(
    __dirname,
    "assets",
    "icons",
    "icon-light_512.png",
  );

  if (!fs.existsSync(darkIconSource) || !fs.existsSync(lightIconSource)) {
    throw new Error(
      "Missing generated icons. Run scripts/generate-icons.js first.",
    );
  }

  fs.copyFileSync(darkIconSource, path.join(iconsDir, "noctra-dark.png"));
  fs.copyFileSync(lightIconSource, path.join(iconsDir, "noctra-light.png"));
  fs.copyFileSync(darkIconSource, path.join(iconsDir, "noctra.png"));

  const executablePath =
    process.env.APPIMAGE && process.env.APPIMAGE.trim().length > 0
      ? process.env.APPIMAGE
      : process.execPath;
  const desktopContent = [
    "[Desktop Entry]",
    "Type=Application",
    "Name=Noctra",
    "Comment=A keyboard-first browser shell with a Neovim-style workflow.",
    `Exec=${executablePath} %u`,
    "Icon=noctra",
    "Terminal=false",
    "Categories=Network;WebBrowser;",
    "MimeType=text/html;x-scheme-handler/http;x-scheme-handler/https;",
  ].join("\n");
  fs.writeFileSync(
    path.join(applicationsDir, "noctra.desktop"),
    `${desktopContent}\n`,
    "utf-8",
  );

  try {
    await execFileAsync("update-desktop-database", [applicationsDir]);
  } catch {
    // Non-fatal: some environments don't include update-desktop-database
  }
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
}

app.on("second-instance", (_event, argv) => {
  const nextUrl = extractHttpUrlFromArgv(argv);
  createWindow();
  if (nextUrl) {
    handleOpenUrl(nextUrl);
  }
});

const browserLanguagePolicy = createBrowserLanguagePolicy({
  session,
  configService,
  app,
});

const { applyBrowserLanguagePreference } = browserLanguagePolicy;
const { isAllowedNavigationUrl } = createUrlPolicyRuntime({
  configService,
  validateNavigableUrl,
});

function focusActiveEditorSurface(context, options = {}) {
  const { buffers } = context;
  const active = buffers.getActive();
  if (!active || !active.isEditable) {
    return;
  }

  buffers.focusActive();
  editorSurface.focus(active, options);
}

function normalizeInput(input) {
  return {
    type: input.type,
    key: input.key,
    ctrl: input.control,
    alt: input.alt,
    shift: input.shift,
    meta: input.meta,
  };
}

function isPrimaryPasteShortcut(normalized, platform) {
  if (!normalized || normalized.type !== "keyDown") return false;
  if (normalized.key !== "v" && normalized.key !== "V") return false;
  if (normalized.alt) return false;
  if (platform === "darwin") {
    return Boolean(normalized.meta && !normalized.ctrl);
  }
  return Boolean(normalized.ctrl && !normalized.meta);
}

function isPointInView(view, x, y) {
  if (!view || typeof view.getBounds !== "function") return false;
  const bounds = view.getBounds();
  const px = Number(x);
  const py = Number(y);
  if (!Number.isFinite(px) || !Number.isFinite(py)) return false;
  return (
    px >= bounds.x &&
    px < bounds.x + bounds.width &&
    py >= bounds.y &&
    py < bounds.y + bounds.height
  );
}

function getBrowserViewForWebContents(win, webContents) {
  if (!win || !webContents || webContents.isDestroyed()) return null;
  const views = win.getBrowserViews();
  for (const view of views) {
    if (view && view.webContents === webContents) {
      return view;
    }
  }
  return null;
}

function sendSyntheticRightClick(webContents, x, y) {
  if (!webContents || webContents.isDestroyed()) return;
  const localX = Number.isFinite(x) ? Math.max(0, Math.floor(x)) : 0;
  const localY = Number.isFinite(y) ? Math.max(0, Math.floor(y)) : 0;
  webContents.sendInputEvent({
    type: "mouseDown",
    x: localX,
    y: localY,
    button: "right",
    clickCount: 1,
  });
  webContents.sendInputEvent({
    type: "mouseUp",
    x: localX,
    y: localY,
    button: "right",
    clickCount: 1,
  });
}

function wrapTemplateClicks(template, onClick) {
  if (!Array.isArray(template)) return [];
  return template.map((item) => {
    if (!item || typeof item !== "object" || typeof item.click !== "function") {
      return item;
    }
    const originalClick = item.click;
    return {
      ...item,
      click: (...args) => {
        originalClick(...args);
        if (typeof onClick === "function") onClick();
      },
    };
  });
}

function closeTelescopeAfterContextAction(context) {
  const { telescopeService, uiShell, getStatuslineModeLabel, appMenu } =
    context;
  if (!telescopeService || !telescopeService.isActive()) return;
  telescopeService.close();
  uiShell.hideTelescope();
  uiShell.updateStatuslineMode(getStatuslineModeLabel());
  if (appMenu) appMenu.sync();
}

function buildTelescopeUrlContextTemplate({
  url,
  dispatch,
  win,
  state,
  clipboard,
}) {
  const normalizedUrl = String(url || "").trim();
  if (!normalizedUrl) return [];
  return [
    {
      label: "Open in New Buffer",
      click: () => {
        dispatch(win, { type: INTENTS.NEW_BUFFER, url: normalizedUrl }, state);
      },
    },
    {
      label: "Open in Split",
      click: () => {
        dispatch(
          win,
          { type: INTENTS.OPEN_URL_IN_SPLIT, url: normalizedUrl },
          state,
        );
      },
    },
    { type: "separator" },
    {
      label: "Copy URL Address",
      click: () => {
        clipboard.writeText(normalizedUrl);
      },
    },
  ];
}

function showTelescopeContextMenu(context, payload = {}) {
  const { telescopeService, uiShell, dispatch, state, win, clipboard } =
    context;
  if (!uiShell || typeof uiShell.showContextMenu !== "function") return;
  if (!telescopeService || !telescopeService.isActive()) return;

  const target = payload.target || null;
  let template = [];

  if (target && target.id === "telescope-prompt") {
    const query = telescopeService.getQuery();
    const hasQuery = query.length > 0;
    template = [
      {
        label: "Cut",
        enabled: hasQuery,
        click: () => {
          if (!query) return;
          clipboard.writeText(query);
          telescopeService.clearQuery();
          uiShell.updateTelescope(telescopeService.buildModel());
        },
      },
      {
        label: "Copy",
        enabled: hasQuery,
        click: () => {
          if (query) clipboard.writeText(query);
        },
      },
      {
        label: "Paste",
        click: () => {
          const text = clipboard.readText();
          if (!text) return;
          telescopeService.appendQuery(text);
          uiShell.updateTelescope(telescopeService.buildModel());
        },
      },
      {
        label: "Delete",
        enabled: hasQuery,
        click: () => {
          telescopeService.clearQuery();
          uiShell.updateTelescope(telescopeService.buildModel());
        },
      },
      { type: "separator" },
      { label: "Select All", enabled: false, click: () => {} },
    ];
  } else if (target && target.role === "telescope-row") {
    const item = telescopeService.getResultAt(target.index);
    if (!item) return;

    if (item.contextKind === "buffers" && Number.isFinite(item.bufferId)) {
      const bufferId = item.bufferId;
      template = [
        {
          label: "Switch to Buffer",
          click: () => {
            dispatch(win, { type: INTENTS.SWITCH_BUFFER, id: bufferId }, state);
          },
        },
        {
          label: "Duplicate Buffer",
          click: () => {
            dispatch(win, { type: INTENTS.DUPLICATE_BUFFER, bufferId }, state);
          },
        },
        {
          label: "Close Buffer",
          click: () => {
            dispatch(win, { type: INTENTS.CLOSE_BUFFER, id: bufferId }, state);
          },
        },
      ];
    } else if (item.contextKind === "history") {
      template = buildTelescopeUrlContextTemplate({
        url: item.subtitle,
        dispatch,
        win,
        state,
        clipboard,
      });
    } else if (item.contextKind === "bookmarks") {
      template = buildTelescopeUrlContextTemplate({
        url: item.subtitle,
        dispatch,
        win,
        state,
        clipboard,
      });
    }

    template = wrapTemplateClicks(template, () => {
      closeTelescopeAfterContextAction(context);
    });
  }

  if (!Array.isArray(template) || template.length === 0) return;
  uiShell.showContextMenu(template, payload.x, payload.y);
}

function reopenContextMenuAt(context, x, y) {
  const { uiShell, win, buffers, sidepanelController } = context;
  if (!uiShell || !win || win.isDestroyed()) return;

  if (
    uiShell.telescopeView &&
    uiShell.isTelescopeVisible() &&
    isPointInView(uiShell.telescopeView, x, y)
  ) {
    const bounds = uiShell.telescopeView.getBounds();
    sendSyntheticRightClick(
      uiShell.telescopeView.webContents,
      x - bounds.x,
      y - bounds.y,
    );
    return;
  }

  const panelWebContents =
    sidepanelController &&
    typeof sidepanelController.getWebContents === "function"
      ? sidepanelController.getWebContents()
      : null;
  const panelView = getBrowserViewForWebContents(win, panelWebContents);
  if (panelView && isPointInView(panelView, x, y)) {
    const b = panelView.getBounds();
    sendSyntheticRightClick(panelWebContents, x - b.x, y - b.y);
    return;
  }

  const candidates = [];
  for (const buffer of buffers.getBuffers()) {
    if (buffer && buffer.webContents && buffer.view) {
      candidates.push(buffer);
    }
  }
  const rightPaneBuffer = buffers.getRightPaneBuffer();
  if (rightPaneBuffer && rightPaneBuffer.webContents && rightPaneBuffer.view) {
    candidates.push(rightPaneBuffer);
  }

  for (const buffer of candidates) {
    if (isPointInView(buffer.view, x, y)) {
      const b = buffer.view.getBounds();
      sendSyntheticRightClick(buffer.webContents, x - b.x, y - b.y);
      return;
    }
  }

  sendSyntheticRightClick(win.webContents, x, y);
}

function handleRawInput(context, event, input) {
  const {
    state,
    buffers,
    sidepanelController,
    bookmarkInsertScopeModal,
    downloadsModal,
    telescopeService,
    uiShell,
    appMenu,
    dispatch,
    win,
    getStatuslineModeLabel,
    updateTablineOptions,
    handleInput,
    shouldPreventDefault,
    handleUrllineInput,
  } = context;

  // Dismiss context menu on any key press
  if (uiShell && uiShell.contextMenuVisible) {
    uiShell.hideContextMenu();
    event.preventDefault();
    return;
  }

  const normalized = normalizeInput(input);
  const focusSnapshot = resolveFocusSnapshot({
    state,
    buffers,
    sidepanelController,
    bookmarkInsertScopeModal,
    downloadsModal,
    telescopeService,
  });
  const priority = resolveInputPriority(
    normalized,
    focusSnapshot,
    state,
    process.platform,
  );
  assertInputPipelinePreconditions({
    input: normalized,
    priority,
    focusSnapshot,
  });

  if (focusSnapshot.bookmarkModalActive) {
    const wasActive = true;
    const consumed = bookmarkInsertScopeModal.handleInput(normalized);
    if (consumed) {
      event.preventDefault();
      if (
        wasActive &&
        !bookmarkInsertScopeModal.isActive() &&
        focusSnapshot.sidepanelVisible
      ) {
        sidepanelController.reloadData();
        sidepanelController.render();
      }
      uiShell.updateStatuslineMode(getStatuslineModeLabel());
      updateTablineOptions();
      if (appMenu) appMenu.sync();
      return;
    }
  }

  if (focusSnapshot.downloadsModalActive) {
    const consumed = downloadsModal.handleInput(normalized);
    if (consumed) {
      event.preventDefault();
      if (!downloadsModal.isActive() && focusSnapshot.sidepanelVisible) {
        sidepanelController.reloadData();
        sidepanelController.render();
      }
      uiShell.updateStatuslineMode(getStatuslineModeLabel());
      updateTablineOptions();
      if (appMenu) appMenu.sync();
      return;
    }
  }

  if (focusSnapshot.telescopeActive) {
    if (isPrimaryPasteShortcut(normalized, process.platform)) {
      event.preventDefault();
      const result = telescopeService.handleInput({
        ...normalized,
        pasteText: clipboard.readText(),
      });
      if (result.consumed) {
        uiShell.updateTelescope(telescopeService.buildModel());
        if (appMenu) appMenu.sync();
        return;
      }
    }

    const result = telescopeService.handleInput(normalized);
    if (result.consumed) {
      event.preventDefault();
      if (result.close) {
        telescopeService.close();
        uiShell.hideTelescope();
        uiShell.updateStatuslineMode(getStatuslineModeLabel());
      } else {
        uiShell.updateTelescope(telescopeService.buildModel());
        if (result.modeChanged) {
          uiShell.updateStatuslineMode(telescopeService.getMode());
        }
      }

      if (result.intent) {
        dispatch(win, result.intent, state);
      }
      if (appMenu) appMenu.sync();
      return;
    }
  }

  if (
    priority.shouldRouteFocusedTreeInput &&
    sidepanelController.handleFocusedInput(normalized)
  ) {
    event.preventDefault();
    uiShell.updateStatuslineMode(getStatuslineModeLabel());
    updateTablineOptions();
    if (appMenu) appMenu.sync();
    return;
  }

  if (priority.isUrllinePasteShortcut) {
    event.preventDefault();
    handleUrllineInput(event, {
      ...normalized,
      pasteText: clipboard.readText(),
    });
    if (appMenu) appMenu.sync();
    return;
  }

  if (priority.shouldRouteUrllineInput) {
    event.preventDefault();
    handleUrllineInput(event, normalized);
    if (appMenu) appMenu.sync();
    return;
  }

  if (priority.isCommandPasteShortcut) {
    event.preventDefault();
    handleInput(win, {
      ...normalized,
      pasteText: clipboard.readText(),
    });
    if (appMenu) appMenu.sync();
    return;
  }

  if (priority.isOpenSettingsShortcut) {
    event.preventDefault();
    dispatch(win, { type: INTENTS.OPEN_SETTINGS_BUFFER }, state);
    if (appMenu) appMenu.sync();
    return;
  }

  if (priority.isBufferShortcut) {
    event.preventDefault();
    if (normalized.key === "T" || normalized.shift) {
      dispatch(win, { type: INTENTS.REOPEN_BUFFER }, state);
    } else {
      dispatch(win, { type: INTENTS.NEW_BUFFER }, state);
    }
    if (appMenu) appMenu.sync();
    return;
  }

  if (priority.shouldBypassToNativeMenu) {
    return;
  }

  if (shouldPreventDefault(normalized)) {
    event.preventDefault();
  }

  handleInput(win, normalized);
  if (appMenu) appMenu.sync();
}

function handleMouseInput(context, _event, input) {
  const { uiShell } = context;
  if (!input || input.type !== "mouseDown" || input.button !== "left") {
    return;
  }

  const dismissIfOutside = (visible, view, dismiss) => {
    if (!visible || typeof dismiss !== "function") return false;
    if (isPointInView(view, input.x, input.y)) return false;
    dismiss();
    return true;
  };

  if (
    dismissIfOutside(
      uiShell.isTelescopeVisible(),
      uiShell.telescopeView,
      uiShell.mouseActions?.dismissTelescope,
    )
  ) {
    return;
  }

  if (
    dismissIfOutside(
      uiShell.isSelectionModalVisible(),
      uiShell.selectionModalView,
      uiShell.mouseActions?.dismissSelectionModal,
    )
  ) {
    return;
  }

  if (
    dismissIfOutside(
      uiShell.isDownloadsModalVisible(),
      uiShell.downloadsModalView,
      uiShell.mouseActions?.dismissDownloadsModal,
    )
  ) {
    return;
  }

  if (
    dismissIfOutside(
      uiShell.whichKeyVisible,
      uiShell.whichKeyOverlayView,
      uiShell.mouseActions?.dismissWhichKey,
    )
  ) {
    return;
  }
}

function syncWebBufferModeWithFocusedElement(
  context,
  webContents,
  options = {},
) {
  const {
    state,
    buffers,
    sidepanelController,
    uiShell,
    appMenu,
    getStatuslineModeLabel,
  } = context;
  const reason =
    typeof options.reason === "string" ? options.reason : "focus-change";
  const shouldForceNormalOnNavigation =
    reason === "did-start-navigation" ||
    reason === "did-navigate" ||
    reason === "did-navigate-in-page";
  if (!webContents || webContents.isDestroyed()) {
    return Promise.resolve();
  }

  if (webContents.isLoading() || webContents.isLoadingMainFrame()) {
    return Promise.resolve();
  }

  const activeBuffer = buffers.getActive();
  const editorFocused =
    isEditorFocused(state) && Boolean(activeBuffer && activeBuffer.isEditable);
  if (
    !activeBuffer ||
    activeBuffer.webContents !== webContents ||
    activeBuffer.isEditable
  ) {
    return Promise.resolve();
  }

  if (
    state.mode === "COMMAND" ||
    state.urllineEditing ||
    sidepanelController.isFocused() ||
    editorFocused ||
    (state.mode !== "NORMAL" && state.mode !== "INSERT")
  ) {
    return Promise.resolve();
  }

  return webContentsActions
    .detectFocusedEditable(webContents)
    .then((isEditableFocused) => {
      if (!webContents || webContents.isDestroyed()) {
        return;
      }
      const latestActive = buffers.getActive();
      if (
        !latestActive ||
        latestActive.webContents !== webContents ||
        latestActive.isEditable
      ) {
        return;
      }

      if (
        state.mode === "COMMAND" ||
        state.urllineEditing ||
        sidepanelController.isFocused() ||
        (isEditorFocused(state) &&
          Boolean(latestActive && latestActive.isEditable)) ||
        (state.mode !== "NORMAL" && state.mode !== "INSERT")
      ) {
        return;
      }

      if (shouldForceNormalOnNavigation && state.mode === "INSERT") {
        setMode(state, "NORMAL", "web-navigation-normalize");
        assertModeWriteBoundary({
          mode: "NORMAL",
          state,
          source: "web-navigation-normalize",
        });
        uiShell.updateStatuslineMode(getStatuslineModeLabel());
        if (appMenu) appMenu.sync();
        return;
      }

      const shouldInsert = Boolean(isEditableFocused);
      const nextMode = shouldInsert ? "INSERT" : "NORMAL";
      if (state.mode === nextMode) {
        return;
      }

      setMode(state, nextMode, "web-focus-sync");
      assertModeWriteBoundary({
        mode: nextMode,
        state,
        source: "web-focus-sync",
      });
      uiShell.updateStatuslineMode(getStatuslineModeLabel());
      if (appMenu) appMenu.sync();
    })
    .catch(() => {});
}

function persistSessionSnapshot(context) {
  const { buffers } = context;
  try {
    const snapshot = buffers.exportSessionSnapshot();
    sessionService.writeSessionSnapshot(snapshot);
  } catch (error) {
    notificationsService.notify({
      severity: "error",
      code: "session_snapshot_persist_failed",
      message: "Failed to persist session snapshot",
      source: "main",
      context: { error: error?.message || String(error) },
    });
  }
}

function findLeaderSequencesForAction(leaderTree, targetAction, path = []) {
  if (!leaderTree || typeof leaderTree !== "object") {
    return [];
  }

  const results = [];

  for (const [key, node] of Object.entries(leaderTree)) {
    if (!node || typeof node !== "object") continue;
    const nextPath = [...path, key];

    if (node.action === targetAction) {
      results.push(nextPath);
    }

    if (node.children && typeof node.children === "object") {
      results.push(
        ...findLeaderSequencesForAction(node.children, targetAction, nextPath),
      );
    }
  }

  return results;
}

function findNormalMappingsForAction(normalMap, targetAction) {
  if (!normalMap || typeof normalMap !== "object") {
    return [];
  }

  const hits = [];
  for (const [keys, actionId] of Object.entries(normalMap)) {
    if (actionId === targetAction) {
      hits.push(keys);
    }
  }
  return hits;
}

function findModMappingsForAction(modMap, targetAction) {
  if (!modMap || typeof modMap !== "object") {
    return [];
  }

  const modLabel = "Ctrl";
  const hits = [];
  for (const [key, actionId] of Object.entries(modMap)) {
    if (actionId === targetAction) {
      const keyText = String(key);
      const withShift =
        keyText.length === 1 && keyText !== keyText.toLowerCase();
      const displayKey = keyText.length === 1 ? keyText.toUpperCase() : keyText;
      hits.push(
        withShift
          ? `${modLabel}+Shift+${displayKey}`
          : `${modLabel}+${displayKey}`,
      );
    }
  }
  return hits;
}

function formatLeaderSequence(seq = []) {
  if (!Array.isArray(seq) || seq.length === 0) return null;
  const rendered = seq.map((part) => (part === "tab" ? "Tab" : part)).join(" ");
  return `<leader> ${rendered}`;
}

function findShortcutLabelForAction(actionId) {
  const leader = configService.getConfigValue("keymap.leader", {});

  const labels = [];
  const normalHits = findNormalMappingsForAction(
    getNormalActionMap(),
    actionId,
  );
  if (normalHits.length > 0) {
    labels.push(normalHits[0]);
  }

  const modHits = findModMappingsForAction(getModActionMap(), actionId);
  if (modHits.length > 0) {
    labels.push(modHits[0]);
  }

  const leaderHits = findLeaderSequencesForAction(leader, actionId);
  if (leaderHits.length > 0) {
    const leaderLabel = formatLeaderSequence(leaderHits[0]);
    if (leaderLabel) {
      labels.push(leaderLabel);
    }
  }

  return labels.length > 0 ? labels.join(" | ") : "";
}

function updateTablineActions(context) {
  const { uiShell } = context;
  const leaderTree = configService.getConfigValue("keymap.leader", {});
  const openSettingsSeqs = findLeaderSequencesForAction(
    leaderTree,
    "open_settings",
  );
  const vimShortcut = formatLeaderSequence(openSettingsSeqs[0]) || "<leader> ,";
  const systemShortcut = process.platform === "darwin" ? "Cmd+," : "Ctrl+,";
  const newBufferShortcut = findShortcutLabelForAction("new_buffer");
  const downloadsLiveShortcut = findShortcutLabelForAction(
    "downloads_live_modal",
  );
  const passwordManagerStatus = context.passwordManagerService
    ? context.passwordManagerService.getStatus()
    : null;
  const passwordManagerShortcut = findShortcutLabelForAction(
    "password_manager_open",
  );
  const newTabShortcut = [newBufferShortcut, ":tab", ":tabnew", ":tabe"]
    .filter((value, index, list) => value && list.indexOf(value) === index)
    .join(" | ");

  uiShell.setTablineActions({
    newTab: {
      label: "New buffer",
      icon: "+",
      shortcutLabel: newTabShortcut,
    },
    settings: {
      label: "Config",
      icon: "󰒓",
      shortcutLabel: `${systemShortcut} | ${vimShortcut}`,
    },
    downloads: {
      label: "Downloads",
      icon: "󰇚",
      shortcutLabel: downloadsLiveShortcut || "<leader> D | :downloads live",
    },
    passwordManager: {
      icon: "󰌆",
      shortcutLabel: passwordManagerShortcut || "<leader> p | :pm",
      status: passwordManagerStatus,
    },
  });
}

function updateTablineOptions(context) {
  const { uiShell, sidepanelController } = context;
  uiShell.setTablineOptions({
    showFavicon: configService.getConfigValue(
      "global.ui.tabline.show_favicon",
      false,
    ),
    dimActiveBuffer: sidepanelController.isFocused(),
  });
}

function updateUrllineActions(context) {
  const { uiShell } = context;
  uiShell.setUrllineActions({
    back: {
      label: "Previous page",
      icon: "󰁍",
      shortcutLabel: findShortcutLabelForAction("nav_back"),
    },
    forward: {
      label: "Next page",
      icon: "󰁔",
      shortcutLabel: findShortcutLabelForAction("nav_forward"),
    },
    reload: {
      label: "Reload page",
      icon: "󰑐",
      shortcutLabel: findShortcutLabelForAction("reload_page"),
    },
  });
}

function generateMenuIcon(glyph, strokeColor, outputPath) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(outputPath)) {
      resolve(outputPath);
      return;
    }
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const fontPath = path.join(
      __dirname,
      "assets",
      "fonts",
      "JetBrainsMonoNerdFontMono-Regular.ttf",
    );
    execFile(
      "magick",
      [
        "-background",
        "none",
        "-fill",
        "transparent",
        "-stroke",
        strokeColor,
        "-strokewidth",
        "1",
        "-font",
        fontPath,
        "-pointsize",
        "14",
        "-gravity",
        "center",
        "-size",
        "16x16",
        `caption:${glyph}`,
        outputPath,
      ],
      (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(outputPath);
        }
      },
    );
  });
}

function normalizeHistoryUrl(rawUrl) {
  if (typeof rawUrl !== "string") return "";
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    parsed.hash = "";
    const normalized = parsed.toString();
    if (normalized.endsWith("/") && parsed.pathname === "/") {
      return normalized.slice(0, -1);
    }
    return normalized;
  } catch {
    return trimmed;
  }
}

function handleOpenUrl(url) {
  const context = getLastWindowContext();
  if (!context || !context.win || context.win.isDestroyed()) {
    pendingUrls.push(url);
    return;
  }
  context.dispatch(context.win, { type: INTENTS.OPEN_URL, url }, context.state);
}

function createWindow() {
  const state = createState();
  const buffers = createBufferManager();
  const uiShell = createUiShellManager();
  const sidepanelController = createHistoryPanel();
  const bookmarkInsertScopeModal = createBookmarkInsertScopeModal({ uiShell });
  const downloadsModal = createDownloadsModal({ uiShell });
  const telescopeService = createTelescopeService();

  const computeStatuslineModeLabel = createStatuslineModeLabelResolver({
    buffers,
    sidepanelController,
    telescopeService,
  });
  const getStatuslineModeLabel = () => computeStatuslineModeLabel(state);

  const context = {
    state,
    buffers,
    uiShell,
    sidepanelController,
    bookmarkInsertScopeModal,
    downloadsModal,
    telescopeService,
    dispatch: null,
    handleInput: () => {},
    shouldPreventDefault: () => false,
    getStatuslineModeLabel,
    computeStatuslineModeLabel,
    appMenu: null,
    win: null,
    handleUrllineInput: () => {},
    updateTablineOptions: () => {},
    clipboard,
    resolveCurrentTheme: () => ({ theme: {}, resolvedMode: "dark" }),
    applyTheme: () => {},
    updateTablineActions: () => {},
    updateUrllineActions: () => {},
    updateUrllineRender: () => {},
    passwordManagerService: null,
    passwordManagerOverlayController: null,
    extensionRuntime: null,
  };

  const passwordManagerOverlayController =
    createPasswordManagerOverlayController({
      getParentWindow: () => context.win,
      focusActiveEditorSurface: (options) =>
        focusActiveEditorSurface(context, options),
      getTheme: () => context.resolveCurrentTheme().theme,
      markSurfaceRole,
      extensionRole: SURFACE_ROLES.EXTENSION,
    });
  context.passwordManagerOverlayController = passwordManagerOverlayController;

  const extensionRuntime = createChromeExtensionRuntime({
    ExtensionRuntimeClass: loadElectronChromeExtensionsClass(),
    session: session.defaultSession,
    bufferManager: buffers,
    getBrowserWindow: () => context.win,
    notificationsService,
    isAppQuitting: () => isAppQuitting,
    onActionPopupCreated: (popup) =>
      passwordManagerOverlayController.handlePopupCreated(popup),
  });
  context.extensionRuntime = extensionRuntime;
  buffers.setExtensionRuntime(extensionRuntime);

  const passwordManagerInstaller = createChromeWebStoreInstaller({
    webStore: loadElectronChromeWebStore(),
    session: session.defaultSession,
    extensionsPath: getExtensionStorePath(),
    allowlist: getManagedExtensionIds(),
    autoUpdate: false,
    loadExtensions: false,
  });

  const passwordManagerService = new PasswordManagerService({
    configService,
    session: session.defaultSession,
    extensionRuntime,
    installer: passwordManagerInstaller,
    notificationsService,
    onStatusChange: () => context.updateTablineActions(),
  });
  context.passwordManagerService = passwordManagerService;

  const applyThemeAcrossWindows = (config) => {
    for (const target of windowContexts.values()) {
      if (typeof target.state.applyConfig === "function") {
        target.state.applyConfig(config);
      }
      const themeContext = target.resolveCurrentTheme();
      target.applyTheme(themeContext, { broadcast: true });
      target.updateTablineActions();
      target.updateTablineOptions();
      target.updateUrllineActions();
      target.updateUrllineRender();
      if (target.appMenu) {
        target.appMenu.rebuild();
      }
    }
  };

  const dispatch = createDispatcher({
    buffers,
    uiShell,
    sidepanelController,
    bookmarkInsertScopeModal,
    downloadsModal,
    telescopeService,
    notificationsService,
    passwordManagerService,
    applyThemeAcrossWindows,
  });
  context.dispatch = dispatch;

  const { handleInput, shouldPreventDefault } = createInputHandler({
    state,
    buffers,
    sidepanelController,
    dispatch,
  });
  context.handleInput = handleInput;
  context.shouldPreventDefault = shouldPreventDefault;

  const themeRuntime = createThemeRuntime({
    configService,
    nativeTheme,
    resolveTheme,
    resolveThemeMode,
    resolveContentColorScheme,
    normalizeThemeMode,
    normalizeContentThemeMode,
    normalizeCustomBase,
    toCssVars,
    buffers,
    uiShell,
    sidepanelController,
    broadcastThemeUpdate: (payload) => {
      if (!context.win) return;
      broadcastUiShellPush({
        win: context.win,
        buffers,
        type: "theme:update",
        payload,
      });
    },
  });
  const { resolveCurrentTheme, buildThemePayload, applyTheme } = themeRuntime;
  context.resolveCurrentTheme = resolveCurrentTheme;
  context.applyTheme = applyTheme;

  const webModeSyncService = createWebModeSyncService({
    syncWebModeWithFocusedElement: (webContents) =>
      syncWebBufferModeWithFocusedElement(context, webContents),
    bindWebModeTracking,
  });

  const inputCoordinator = createInputCoordinator({
    buffers,
    webModeSyncService,
    handleRawInput: (event, input) => handleRawInput(context, event, input),
    handleMouseInput: (event, input) => handleMouseInput(context, event, input),
  });

  let updateUrllineRender = () => {};
  let updateLoadinglineRender = () => {};
  let startUrllineEdit = () => {};
  let stopUrllineEdit = () => {};

  const urllineCoordinator = createUrllineCoordinator({
    state,
    uiShell,
    buffers,
    enterInsertMode,
    enterNormalMode,
    startUrllineEditState,
    stopUrllineEditState,
    moveUrllineCursor,
    setUrllineCursor,
    insertUrllineTextAtCursor,
    deleteUrllineBackward,
    deleteUrllineForward,
    resolveInputTarget,
    getDefaultSearchEngine: () =>
      configService.getConfigValue(
        "browser.default_search_engine",
        "duckduckgo",
      ),
    getStatuslineModeLabel,
  });
  updateUrllineRender = urllineCoordinator.updateUrllineRender;
  updateLoadinglineRender = urllineCoordinator.updateLoadinglineRender;
  startUrllineEdit = urllineCoordinator.startUrllineEdit;
  stopUrllineEdit = urllineCoordinator.stopUrllineEdit;
  context.handleUrllineInput = urllineCoordinator.handleUrllineInput;
  context.updateUrllineRender = updateUrllineRender;
  context.updateLoadinglineRender = updateLoadinglineRender;

  const { applyReloadedConfig } = createConfigRuntime({
    state,
    resetLeaderSession,
    resetSequenceBuffers,
    applyBrowserLanguagePreference,
    buffers,
    configService,
    sidepanelController,
    resolveCurrentTheme,
    applyTheme,
    uiShell,
    updateTablineActions: () => updateTablineActions(context),
    updateTablineOptions: () => updateTablineOptions(context),
    updateUrllineActions: () => updateUrllineActions(context),
    updateUrllineRender,
    updateLoadinglineRender,
  });

  context.updateTablineActions = () => updateTablineActions(context);
  context.updateTablineOptions = () => updateTablineOptions(context);
  context.updateUrllineActions = () => updateUrllineActions(context);

  const persistSnapshot = () => persistSessionSnapshot(context);

  const runtime = bootstrapWindowRuntime({
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
    handleRawInput: (event, input) => handleRawInput(context, event, input),
    handleMouseInput: (event, input) => handleMouseInput(context, event, input),
    isEditorFocused,
    wireWindowLifecycle,
    getSurfaceRole,
    isAllowedTrustedSurfaceUrl,
    SURFACE_ROLES,
    markSurfaceRole,
    performWindowAction,
    setEditorFocused,
    enterCommandMode,
    focusActiveEditorSurface: (options) =>
      focusActiveEditorSurface(context, options),
    getStatuslineModeLabel,
    startUrllineEdit,
    resolveCurrentTheme,
    buildThemePayload,
    applyReloadedConfig,
    applyTheme,
    updateTablineActions: () => updateTablineActions(context),
    updateTablineOptions: () => updateTablineOptions(context),
    updateUrllineActions: () => updateUrllineActions(context),
    updateUrllineRender,
    updateLoadinglineRender,
    stopUrllineEdit,
    normalizeHistoryUrl,
    applyBrowserLanguagePreference,
    persistSessionSnapshot: persistSnapshot,
    clipboard,
    passwordManagerService,
    extensionRuntime,
  });

  context.win = runtime.win;
  context.smokeScenarios = runtime.smokeScenarios;
  passwordManagerService.initialize().catch((error) => {
    notificationsService.notify({
      severity: "warning",
      code: "password_manager_initialize_failed",
      message:
        error && error.message
          ? error.message
          : "Password manager failed to initialize.",
      source: "main",
      persist: false,
    });
  });

  const appMenu = createAppMenu({
    win: context.win,
    state,
    buffers,
    sidepanelController,
    dispatch,
    INTENTS,
    app,
    dialog,
    isBookmarkableBuffer,
    openDoc,
    configService,
    historyService,
    bookmarksService,
    entryIcons,
    nativeTheme,
    createWindow,
  });
  context.appMenu = appMenu;

  const unregisterWebContextMenu = registerWebContextMenu({
    win: context.win,
    buffers,
    configService,
    dispatch,
    state,
    INTENTS,
    validateNavigableUrl,
    isBookmarkableBuffer,
    clipboard,
    dialog,
    uiShell,
  });

  windowContexts.set(context.win.id, context);
  uiShell.setMouseActions({
    isPointInView,
    dismissSelectionModal: () => {
      const wasActive = bookmarkInsertScopeModal.isActive();
      bookmarkInsertScopeModal.close();
      if (wasActive && sidepanelController.isVisible()) {
        sidepanelController.reloadData();
        sidepanelController.render();
      }
      uiShell.updateStatuslineMode(getStatuslineModeLabel());
      updateTablineOptions();
      buffers.focusActive();
      if (appMenu) appMenu.sync();
    },
    selectBookmarkModalIndex: (index) => {
      const wasActive = bookmarkInsertScopeModal.isActive();
      const consumed = bookmarkInsertScopeModal.selectIndex(index);
      if (!consumed) return;
      if (
        wasActive &&
        !bookmarkInsertScopeModal.isActive() &&
        sidepanelController.isVisible()
      ) {
        sidepanelController.reloadData();
        sidepanelController.render();
      }
      uiShell.updateStatuslineMode(getStatuslineModeLabel());
      updateTablineOptions();
      if (!bookmarkInsertScopeModal.isActive()) {
        buffers.focusActive();
      }
      if (appMenu) appMenu.sync();
    },
    dismissDownloadsModal: () => {
      if (!downloadsModal.isActive()) return;
      downloadsModal.close();
      uiShell.updateStatuslineMode(getStatuslineModeLabel());
      if (sidepanelController.isVisible()) {
        sidepanelController.render();
      }
      buffers.focusActive();
      if (appMenu) appMenu.sync();
    },
    dismissWhichKey: () => {
      if (!uiShell.whichKeyVisible) return;
      resetLeaderSession(state);
      uiShell.hideWhichKey();
      uiShell.updateStatuslineMode(getStatuslineModeLabel());
      buffers.focusActive();
      if (appMenu) appMenu.sync();
    },
    dismissTelescope: () => {
      if (!telescopeService.isActive()) return;
      telescopeService.close();
      uiShell.hideTelescope();
      uiShell.updateStatuslineMode(getStatuslineModeLabel());
      buffers.focusActive();
      if (appMenu) appMenu.sync();
    },
    dismissContextMenu: () => {
      buffers.focusActive();
      uiShell.updateStatuslineMode(getStatuslineModeLabel());
      if (appMenu) appMenu.sync();
    },
    reopenContextMenuAt: (x, y) => {
      reopenContextMenuAt(context, x, y);
    },
    showTelescopeContextMenu: ({ x, y, target }) => {
      showTelescopeContextMenu(context, { x, y, target });
    },
    focusTelescopePrompt: () => {
      if (!telescopeService.isActive()) return;
      telescopeService.setMode("INSERT");
      uiShell.updateStatuslineMode(telescopeService.getMode());
      if (uiShell.telescopeView && uiShell.telescopeView.webContents) {
        uiShell.telescopeView.webContents.focus();
      }
      if (appMenu) appMenu.sync();
    },
    openTelescopeIndex: (index) => {
      if (!telescopeService.isActive()) return;
      telescopeService.setSelectedIndex(index);
      const intent = telescopeService.submit(false);
      telescopeService.close();
      uiShell.hideTelescope();
      uiShell.updateStatuslineMode(getStatuslineModeLabel());
      buffers.focusActive();
      if (intent) {
        dispatch(context.win, intent, state);
      }
      if (appMenu) appMenu.sync();
    },
    hoverTelescopeIndex: (index) => {
      if (!telescopeService.isActive()) return;
      const next = Number.isFinite(index) ? Math.floor(index) : -1;
      if (next < 0) return;
      const current = telescopeService.getSelectedIndex();
      if (current === next) return;
      telescopeService.setSelectedIndex(next);
      uiShell.updateTelescope(telescopeService.buildModel());
    },
    clickDownloadsModalIndex: (index, clickCount = 1) => {
      const consumed = downloadsModal.clickIndex(index, clickCount);
      if (!consumed) return;
      uiShell.updateStatuslineMode(getStatuslineModeLabel());
      if (appMenu) appMenu.sync();
    },
    handleBackdropMouseEvent: (input) => {
      handleMouseInput(context, null, input);
    },
  });
  const overlayInputViews = [
    uiShell.toastOverlayView,
    uiShell.telescopeView,
    uiShell.selectionModalView,
    uiShell.whichKeyOverlayView,
    uiShell.downloadsModalView,
  ];
  for (const view of overlayInputViews) {
    if (!view || !view.webContents || view.webContents.isDestroyed()) continue;
    view.webContents.on("before-input-event", (event, input) => {
      handleRawInput(context, event, input);
    });
  }
  appMenu.sync();
  buffers.subscribe(() => appMenu.rebuild());

  app
    .getFileIcon(os.homedir(), { size: "small" })
    .then((icon) => {
      if (icon && !icon.isEmpty()) {
        appMenu.setFolderIcon(icon);
      }
    })
    .catch(() => {
      // Native folder icon unavailable, ignore
    });

  context.win.on("closed", () => {
    if (typeof unregisterWebContextMenu === "function") {
      unregisterWebContextMenu();
    }
    windowContexts.delete(context.win.id);
  });

  return context.win;
}

app.whenReady().then(async () => {
  if (process.platform === "linux" && process.argv.includes("--integrate")) {
    try {
      await integrateLinuxAppImage();
      app.quit();
      return;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      dialog.showErrorBox("Noctra Integration Failed", reason);
      app.quit();
      return;
    }
  }

  registerSessionSecurityPolicyAdapter({
    session,
    app,
    configService,
    notificationsService,
  });
  registerWebContentsSecurityPolicyAdapter({
    app,
    isAllowedNavigationUrl,
    notificationsService,
    openExtensionWindowUrl: (url) => {
      const context = getLastWindowContext();
      if (!context || !context.buffers) {
        return;
      }
      context.buffers.create(url, { activate: true });
    },
  });

  try {
    registerChromeExtensionPreloads({ session });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    notificationsService.notify({
      severity: "warning",
      code: "extension_preload_registration_failed",
      message: "Chrome extension preload registration failed",
      source: "main",
      context: { reason },
      persist: false,
    });
  }

  try {
    const blackPath = path.join(
      __dirname,
      "assets",
      "menu-icons",
      "entry-black.png",
    );
    const whitePath = path.join(
      __dirname,
      "assets",
      "menu-icons",
      "entry-white.png",
    );
    await Promise.all([
      generateMenuIcon("\uf15b", "#000000", blackPath),
      generateMenuIcon("\uf15b", "#ffffff", whitePath),
    ]);
    if (process.platform === "darwin") {
      const macosImg = nativeImage.createFromPath(blackPath);
      if (!macosImg.isEmpty()) {
        macosImg.setTemplateImage(true);
        entryIcons = { macos: macosImg };
      }
    } else {
      const darkImg = nativeImage.createFromPath(whitePath);
      const lightImg = nativeImage.createFromPath(blackPath);
      if (!darkImg.isEmpty() && !lightImg.isEmpty()) {
        entryIcons = { dark: darkImg, light: lightImg };
      }
    }
  } catch {
    // Icon generation failed, menu will fall back to text-only
  }

  createWindow();

  // Process any URLs that arrived before the window was ready
  while (pendingUrls.length > 0) {
    const url = pendingUrls.shift();
    handleOpenUrl(url);
  }

  nativeTheme.on("updated", () => {
    for (const context of windowContexts.values()) {
      if (context.appMenu) {
        context.appMenu.rebuild();
      }
    }
  });

  for (const context of windowContexts.values()) {
    if (context.smokeScenarios) {
      context.smokeScenarios.maybeScheduleSmokeExit();
    }
  }
});

app.on("open-url", (event, url) => {
  event.preventDefault();
  handleOpenUrl(url);
});

app.on("before-quit", (event) => {
  isAppQuitting = true;
  if (extensionShutdownComplete) {
    return;
  }

  event.preventDefault();
  shutdownManagedExtensionsForQuit().finally(() => {
    app.quit();
  });
});

app.on("will-quit", () => {
  isAppQuitting = true;
});

const initialArgUrl = extractHttpUrlFromArgv(process.argv);
if (initialArgUrl) {
  handleOpenUrl(initialArgUrl);
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

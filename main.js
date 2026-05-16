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
const buffers = require("./browser/manager");
const { handleInput, shouldPreventDefault } = require("./core/input");
const state = require("./core/state");
require("dotenv").config();

const configService = require("./core/config/service");
const uiShell = require("./ui/shell/manager");
const { dispatch } = require("./core/dispatcher");
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
const sidepanelController = require("./core/sidepanel/controller");
const bookmarkInsertScopeModal = require("./core/bookmarks/insertScopeModal");
const downloadsModal = require("./core/downloads/modal");
const telescopeService = require("./core/telescope/service");
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
const { computeStatuslineModeLabel } = require("./core/statuslineModeLabel");
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
const {
  createBrowserLanguagePolicy,
} = require("./runtime/browserLanguagePolicy");
const { createThemeRuntime } = require("./runtime/themeRuntime");
const { createUrlPolicyRuntime } = require("./runtime/urlPolicyRuntime");
const { createConfigRuntime } = require("./runtime/configRuntime");
const { createUrllineCoordinator } = require("./runtime/urllineCoordinator");
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

let win;
let smokeScenarios = null;
let appMenu;
let entryIcons = null;
let pendingUrls = [];

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

  const darkIconSource = path.join(__dirname, "assets", "icons", "icon-dark_512.png");
  const lightIconSource = path.join(__dirname, "assets", "icons", "icon-light_512.png");

  if (!fs.existsSync(darkIconSource) || !fs.existsSync(lightIconSource)) {
    throw new Error("Missing generated icons. Run scripts/generate-icons.js first.");
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
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
  if (nextUrl) {
    handleOpenUrl(nextUrl);
  }
});

const browserLanguagePolicy = createBrowserLanguagePolicy({
  session,
  configService,
});

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
    broadcastUiShellPush({ win, buffers, type: "theme:update", payload });
  },
});

const { applyBrowserLanguagePreference } = browserLanguagePolicy;
const { resolveCurrentTheme, buildThemePayload, applyTheme } = themeRuntime;
const { isAllowedNavigationUrl } = createUrlPolicyRuntime({
  configService,
  validateNavigableUrl,
});

function focusActiveEditorSurface(options = {}) {
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

function handleRawInput(event, input) {
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

function handleMouseInput(_event, input) {
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

function syncWebBufferModeWithFocusedElement(webContents) {
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

const webModeSyncService = createWebModeSyncService({
  syncWebModeWithFocusedElement: syncWebBufferModeWithFocusedElement,
  bindWebModeTracking,
});

const inputCoordinator = createInputCoordinator({
  buffers,
  webModeSyncService,
  handleRawInput,
  handleMouseInput,
});

function persistSessionSnapshot() {
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

function getStatuslineModeLabel() {
  return computeStatuslineModeLabel(state);
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

function updateTablineActions() {
  const leaderTree = configService.getConfigValue("keymap.leader", {});
  const openSettingsSeqs = findLeaderSequencesForAction(
    leaderTree,
    "open_settings",
  );
  const vimShortcut = formatLeaderSequence(openSettingsSeqs[0]) || "<leader> ,";
  const systemShortcut = process.platform === "darwin" ? "Cmd+," : "Ctrl+,";
  const newBufferShortcut = findShortcutLabelForAction("new_buffer");
  const downloadsLiveShortcut = findShortcutLabelForAction("downloads_live_modal");
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
  });
}

function updateTablineOptions() {
  uiShell.setTablineOptions({
    showFavicon: configService.getConfigValue(
      "global.ui.tabline.show_favicon",
      false,
    ),
    dimActiveBuffer: sidepanelController.isFocused(),
  });
}

let updateUrllineRender = () => {};
let startUrllineEdit = () => {};
let stopUrllineEdit = () => {};
let handleUrllineInput = () => {};

function updateUrllineActions() {
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
    configService.getConfigValue("browser.default_search_engine", "duckduckgo"),
  getStatuslineModeLabel,
});

updateUrllineRender = urllineCoordinator.updateUrllineRender;
startUrllineEdit = urllineCoordinator.startUrllineEdit;
stopUrllineEdit = urllineCoordinator.stopUrllineEdit;
handleUrllineInput = urllineCoordinator.handleUrllineInput;

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
  updateTablineActions,
  updateTablineOptions,
  updateUrllineActions,
  updateUrllineRender,
});

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
  if (!win || win.isDestroyed()) {
    pendingUrls.push(url);
    return;
  }
  dispatch(win, { type: INTENTS.OPEN_URL, url }, state);
}

function createWindow() {
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
    stopUrllineEdit,
    normalizeHistoryUrl,
    applyBrowserLanguagePreference,
    persistSessionSnapshot,
  });

  win = runtime.win;
  smokeScenarios = runtime.smokeScenarios;

  appMenu = createAppMenu({
    win,
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
  });
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
        dispatch(win, intent, state);
      }
      if (appMenu) appMenu.sync();
    },
    clickDownloadsModalIndex: (index, clickCount = 1) => {
      const consumed = downloadsModal.clickIndex(index, clickCount);
      if (!consumed) return;
      uiShell.updateStatuslineMode(getStatuslineModeLabel());
      if (appMenu) appMenu.sync();
    },
    handleBackdropMouseEvent: (input) => {
      handleMouseInput(null, input);
    },
  });
  const overlayInputViews = [
    uiShell.telescopeView,
    uiShell.selectionModalView,
    uiShell.whichKeyOverlayView,
    uiShell.downloadsModalView,
  ];
  for (const view of overlayInputViews) {
    if (!view || !view.webContents || view.webContents.isDestroyed()) continue;
    view.webContents.on("before-input-event", (event, input) => {
      handleRawInput(event, input);
    });
  }
  appMenu.sync();
  buffers.subscribe(() => appMenu.rebuild());

  app.getFileIcon(os.homedir(), { size: "small" })
    .then((icon) => {
      if (icon && !icon.isEmpty()) {
        appMenu.setFolderIcon(icon);
      }
    })
    .catch(() => {
      // Native folder icon unavailable, ignore
    });
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
  });

  try {
    const blackPath = path.join(__dirname, "assets", "menu-icons", "entry-black.png");
    const whitePath = path.join(__dirname, "assets", "menu-icons", "entry-white.png");
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
    if (appMenu) appMenu.rebuild();
  });

  if (smokeScenarios) {
    smokeScenarios.maybeScheduleSmokeExit();
  }
});

app.on("open-url", (event, url) => {
  event.preventDefault();
  handleOpenUrl(url);
});

const initialArgUrl = extractHttpUrlFromArgv(process.argv);
if (initialArgUrl) {
  handleOpenUrl(initialArgUrl);
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

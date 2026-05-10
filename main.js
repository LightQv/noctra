const path = require("path");
const fs = require("fs");
const { app, BrowserWindow, ipcMain, clipboard, nativeTheme, screen, session } = require("electron");
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
  resolveTheme,
  resolveThemeMode,
  resolveContentColorScheme,
  toCssVars,
} = require("./ui/theme");
const { resolveInputTarget } = require("./core/resolver");
const historyService = require("./core/history/service");
const historyPanel = require("./core/history/panel");
const bookmarkInsertScopeModal = require("./core/bookmarks/insertScopeModal");
const telescopeService = require("./core/telescope/service");
const { resolveFocusSnapshot } = require("./core/focusResolver");
const { resolveInputPriority } = require("./core/inputPriorityResolver");
const { setMode, enterInsertMode, enterNormalMode, enterCommandMode } = require("./core/modeTransitionService");
const { setEditorFocused, isEditorFocused } = require("./core/editorFocusState");
const { computeStatuslineModeLabel } = require("./core/statuslineModeLabel");
const { assertInputPipelinePreconditions, assertModeWriteBoundary } = require("./core/invariants");
const sessionService = require("./core/session/service");
const notificationsService = require("./core/notifications/service");
const { validateNavigableUrl } = require("./core/security/urlPolicy");
const {
  SURFACE_ROLES,
  markSurfaceRole,
  getSurfaceRole,
  isAllowedTrustedSurfaceUrl,
} = require("./core/security/surfaceTrust");
const { performWindowAction } = require("./core/adapters/platform/windowActions");
const webContentsActions = require("./core/adapters/platform/webContentsActions");
const { bindWebModeTracking } = require("./core/adapters/platform/webContentsEvents");
const {
  registerSessionSecurityPolicy: registerSessionSecurityPolicyAdapter,
  registerWebContentsSecurityPolicy: registerWebContentsSecurityPolicyAdapter,
} = require("./core/adapters/platform/securityPolicy");
const { registerIpcContracts } = require("./core/adapters/platform/ipcRegistry");
const editorSurface = require("./core/adapters/renderer/editorSurface");
const { broadcastUiShellPush } = require("./core/adapters/renderer/uiShellPush");
const { createWebModeSyncService } = require("./core/webModeSyncService");
const { getNormalActionMap, getModActionMap } = require("./motions/keymap");
const { createInputCoordinator } = require("./runtime/inputCoordinator");
const { registerRuntimeIpc } = require("./runtime/ipcRegistration");
const { wireWindowLifecycle } = require("./runtime/windowLifecycle");
const { createSmokeScenarios } = require("./runtime/smokeScenarios");
const { resetLeaderSession, resetSequenceBuffers } = require("./core/state/leaderState");
const {
  moveUrllineCursor,
  setUrllineCursor,
  startUrllineEditState,
  stopUrllineEditState,
  insertUrllineTextAtCursor,
  deleteUrllineBackward,
  deleteUrllineForward,
} = require("./core/state/urllineState");
let win;
let browserLanguageHooksRegistered = false;
let smokeScenarios = null;

function isFiniteInteger(value) {
  return Number.isFinite(value) && Number.isInteger(value);
}

function isBoundsVisibleOnAnyDisplay(bounds) {
  if (!bounds || !Number.isFinite(bounds.width) || !Number.isFinite(bounds.height)) {
    return false;
  }

  const displays = screen.getAllDisplays();
  return displays.some((display) => {
    const area = display.workArea;
    const intersectsHorizontally = bounds.x < area.x + area.width && bounds.x + bounds.width > area.x;
    const intersectsVertically =
      bounds.y < area.y + area.height && bounds.y + bounds.height > area.y;
    return intersectsHorizontally && intersectsVertically;
  });
}

function mapBrowserLanguageToAcceptLanguage(languageCode) {
  const normalized = typeof languageCode === "string" ? languageCode.trim().toLowerCase() : "en";
  if (normalized === "fr") {
    return "fr-FR,fr;q=0.9,en;q=0.8";
  }
  return "en-US,en;q=0.9";
}

function isGoogleHost(hostname) {
  if (typeof hostname !== "string") {
    return false;
  }

  const normalized = hostname.trim().toLowerCase();
  return normalized === "google.com" || normalized.endsWith(".google.com") || normalized.includes(".google.");
}

function mapBrowserLanguageToGoogleLocale(languageCode) {
  const normalized = typeof languageCode === "string" ? languageCode.trim().toLowerCase() : "en";
  if (normalized === "fr") {
    return { hl: "fr", gl: "FR", lr: "lang_fr" };
  }
  return { hl: "en", gl: "US", lr: "lang_en" };
}

function applyGoogleLocaleHint(rawUrl, preferredLanguage) {
  if (typeof rawUrl !== "string" || !rawUrl.length) {
    return rawUrl;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  if ((parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") || !isGoogleHost(parsedUrl.hostname)) {
    return rawUrl;
  }

  const locale = mapBrowserLanguageToGoogleLocale(preferredLanguage);
  const currentHl = parsedUrl.searchParams.get("hl");
  const currentGl = parsedUrl.searchParams.get("gl");
  const currentLr = parsedUrl.searchParams.get("lr");
  const nextHl = locale.hl;
  const nextGl = locale.gl;
  const nextLr = locale.lr;

  if (currentHl === nextHl && currentGl === nextGl && currentLr === nextLr) {
    return rawUrl;
  }

  parsedUrl.searchParams.set("hl", nextHl);
  parsedUrl.searchParams.set("gl", nextGl);
  parsedUrl.searchParams.set("lr", nextLr);
  return parsedUrl.toString();
}

function applyBrowserLanguagePreference() {
  if (browserLanguageHooksRegistered) {
    return;
  }

  session.defaultSession.webRequest.onBeforeRequest({ urls: ["*://*/*"] }, (details, callback) => {
    if (details.resourceType !== "mainFrame") {
      callback({});
      return;
    }

    const preferredLanguage = configService.getConfigValue("browser.language", "en");
    const redirectURL = applyGoogleLocaleHint(details.url, preferredLanguage);
    if (redirectURL && redirectURL !== details.url) {
      callback({ redirectURL });
      return;
    }

    callback({});
  });

  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ["*://*/*"] }, (details, callback) => {
    const preferredLanguage = configService.getConfigValue("browser.language", "en");
    const acceptLanguage = mapBrowserLanguageToAcceptLanguage(preferredLanguage);
    const requestHeaders = {
      ...(details.requestHeaders || {}),
      "Accept-Language": acceptLanguage,
    };
    callback({ requestHeaders });
  });

  browserLanguageHooksRegistered = true;
}

function getUrlPolicyConfig() {
  return {
    allowHttpLoopback: configService.getConfigValue("browser.allow_http_loopback", true),
    allowHttpPrivateLan: configService.getConfigValue("browser.allow_http_private_lan", true),
    trustedHttpHosts: configService.getConfigValue("browser.trusted_http_hosts", []),
  };
}

function isAllowedNavigationUrl(rawUrl) {
  return validateNavigableUrl(rawUrl, getUrlPolicyConfig()).ok;
}

function resolveCurrentTheme() {
  const themeConfig = configService.getConfigValue("global.theme", {});
  const systemPrefersDark = nativeTheme.shouldUseDarkColors;
  const configuredMode = normalizeThemeMode(
    typeof themeConfig?.mode === "string" ? themeConfig.mode : themeConfig?.name,
    "dark",
  );
  const resolvedMode = resolveThemeMode(themeConfig, { systemPrefersDark });
  const contentMode = normalizeContentThemeMode(themeConfig?.content_mode, "dark");
  const contentColorScheme = resolveContentColorScheme(themeConfig, { systemPrefersDark });
  const theme = resolveTheme(themeConfig, { systemPrefersDark });

  return {
    theme,
    configuredMode,
    resolvedMode,
    contentMode,
    contentColorScheme,
  };
}

function buildThemePayload(themeContext) {
  const theme = themeContext && themeContext.theme ? themeContext.theme : themeContext || {};
  const resolvedMode =
    themeContext && typeof themeContext.resolvedMode === "string"
      ? themeContext.resolvedMode
      : "dark";

  return {
    theme,
    themeVars: toCssVars(theme),
    colorScheme: resolvedMode === "light" ? "light" : "dark",
    resolvedMode,
  };
}

function syncContentUiTheme(theme) {
  const contentColorScheme = theme.contentColorScheme === "light" ? "light" : "dark";
  buffers.setContentUiOptions({
    thumbColor: theme.scrollbarThumbColor,
    thumbActiveColor: theme.scrollbarThumbActiveColor,
    contentColorScheme,
  });
}

function applyTheme(themeContext, options = {}) {
  const shouldBroadcast = Boolean(options.broadcast);
  const payload = buildThemePayload(themeContext);
  uiShell.setTheme(payload.theme);
  syncContentUiTheme({
    ...payload.theme,
    contentColorScheme:
      themeContext && themeContext.contentColorScheme === "light" ? "light" : "dark",
  });
  buffers.refreshDashboardBuffers();
  if (shouldBroadcast) {
    broadcastUiShellPush({ win, buffers, type: "theme:update", payload });
  }
}

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

function handleRawInput(event, input) {
  const normalized = normalizeInput(input);
  const focusSnapshot = resolveFocusSnapshot({
    state,
    buffers,
    historyPanel,
    bookmarkInsertScopeModal,
    telescopeService,
  });
  const priority = resolveInputPriority(normalized, focusSnapshot, state, process.platform);
  assertInputPipelinePreconditions({ input: normalized, priority, focusSnapshot });

  if (focusSnapshot.bookmarkModalActive) {
    const wasActive = true;
    const consumed = bookmarkInsertScopeModal.handleInput(normalized);
    if (consumed) {
      event.preventDefault();
      if (wasActive && !bookmarkInsertScopeModal.isActive() && focusSnapshot.historyPanelVisible) {
        historyPanel.reloadData();
        historyPanel.render();
      }
      uiShell.updateStatuslineMode(getStatuslineModeLabel());
      updateTablineOptions();
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
      return;
    }
  }

  if (priority.shouldRouteFocusedTreeInput && historyPanel.handleFocusedInput(normalized)) {
    event.preventDefault();
    uiShell.updateStatuslineMode(getStatuslineModeLabel());
    updateTablineOptions();
    return;
  }

  if (priority.isUrllinePasteShortcut) {
    event.preventDefault();
    handleUrllineInput(event, {
      ...normalized,
      pasteText: clipboard.readText(),
    });
    return;
  }

  if (priority.shouldRouteUrllineInput) {
    event.preventDefault();
    handleUrllineInput(event, normalized);
    return;
  }

  if (priority.isCommandPasteShortcut) {
    event.preventDefault();
    handleInput(win, {
      ...normalized,
      pasteText: clipboard.readText(),
    });
    return;
  }

  if (priority.isOpenSettingsShortcut) {
    event.preventDefault();
    dispatch(win, { type: INTENTS.OPEN_SETTINGS_BUFFER }, state);
    return;
  }

  if (priority.isBufferShortcut) {
    event.preventDefault();
    if (normalized.key === "T" || normalized.shift) {
      dispatch(win, { type: INTENTS.REOPEN_BUFFER }, state);
    } else {
      dispatch(win, { type: INTENTS.NEW_BUFFER }, state);
    }
    return;
  }

  if (shouldPreventDefault(normalized)) {
    event.preventDefault();
  }

  handleInput(win, normalized);
}

function syncWebBufferModeWithFocusedElement(webContents) {
  if (!webContents || webContents.isDestroyed()) {
    return Promise.resolve();
  }

  if (webContents.isLoading() || webContents.isLoadingMainFrame()) {
    return Promise.resolve();
  }

  const activeBuffer = buffers.getActive();
  const editorFocused = isEditorFocused(state) && Boolean(activeBuffer && activeBuffer.isEditable);
  if (!activeBuffer || activeBuffer.webContents !== webContents || activeBuffer.isEditable) {
    return Promise.resolve();
  }

  if (
    state.mode === "COMMAND" ||
    state.urllineEditing ||
    historyPanel.isFocused() ||
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
      if (!latestActive || latestActive.webContents !== webContents || latestActive.isEditable) {
        return;
      }

      if (
        state.mode === "COMMAND" ||
        state.urllineEditing ||
        historyPanel.isFocused() ||
        (isEditorFocused(state) && Boolean(latestActive && latestActive.isEditable)) ||
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
      assertModeWriteBoundary({ mode: nextMode, state, source: "web-focus-sync" });
      uiShell.updateStatuslineMode(getStatuslineModeLabel());
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
      results.push(...findLeaderSequencesForAction(node.children, targetAction, nextPath));
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
      const withShift = keyText.length === 1 && keyText !== keyText.toLowerCase();
      const displayKey = keyText.length === 1 ? keyText.toUpperCase() : keyText;
      hits.push(withShift ? `${modLabel}+Shift+${displayKey}` : `${modLabel}+${displayKey}`);
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
  const normalHits = findNormalMappingsForAction(getNormalActionMap(), actionId);
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
  const openSettingsSeqs = findLeaderSequencesForAction(leaderTree, "open_settings");
  const vimShortcut = formatLeaderSequence(openSettingsSeqs[0]) || "<leader> ,";
  const systemShortcut = process.platform === "darwin" ? "Cmd+," : "Ctrl+,";
  const newBufferShortcut = findShortcutLabelForAction("new_buffer");
  const historyToggleShortcut = findShortcutLabelForAction("history_toggle");
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
    history: {
      label: "History",
      icon: "󰋚",
      shortcutLabel: historyToggleShortcut || "<leader> e | :history show",
    },
  });
}

function updateTablineOptions() {
  uiShell.setTablineOptions({
    showFavicon: configService.getConfigValue("global.ui.tabline.show_favicon", false),
    dimActiveBuffer: historyPanel.isFocused(),
  });
}

function buildUrllineModel() {
  const model = buffers.getUrllineRenderModel();
  if (!state.urllineEditing) {
    return model;
  }

  return {
    ...model,
    editing: {
      active: true,
      pane: state.urllinePane === "right" ? "right" : "left",
      text: state.urllineBuffer,
      cursorIndex: state.urllineCursorIndex,
    },
  };
}

function updateUrllineRender() {
  uiShell.renderUrlline(buildUrllineModel());
}

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

function resetLeaderRuntimeState() {
  resetLeaderSession(state);
}

function applyReloadedConfig(config, { refreshLayout = false } = {}) {
  state.applyConfig(config);
  resetLeaderRuntimeState();
  resetSequenceBuffers(state);

  applyBrowserLanguagePreference();
  buffers.setUrllineVisible(configService.getConfigValue("global.ui.urlline.enabled", false));
  historyPanel.setWidthRatio(configService.getConfigValue("global.ui.sidepanel.width_ratio", 0.2));
  historyPanel.setTreeScrollContextLines(
    configService.getConfigValue("global.ui.sidepanel.tree_scroll_context_lines", 3),
  );
  historyPanel.setTreeDeleteOperatorTimeoutMs(
    configService.getConfigValue("global.ui.sidepanel.delete_operator_timeout_ms", 900),
  );

  if (refreshLayout) {
    historyPanel.layout();
    buffers.layoutViews();
  }

  const themeContext = resolveCurrentTheme();
  applyTheme(themeContext, { broadcast: true });
  uiShell.updateSplitDivider(buffers.getSplitStatus());
  updateTablineActions();
  updateTablineOptions();
  updateUrllineActions();
  updateUrllineRender();
}

function getStatuslineModeLabel() {
  return computeStatuslineModeLabel(state);
}

function startUrllineEdit(pane, initialUrl) {
  startUrllineEditState(state, pane, initialUrl);
  enterInsertMode(state, "urlline-start-edit");
  uiShell.updateStatuslineMode(getStatuslineModeLabel());
  updateUrllineRender();
}

function stopUrllineEdit() {
  stopUrllineEditState(state);
  enterNormalMode(state, "urlline-stop-edit");
  uiShell.updateStatuslineMode(getStatuslineModeLabel());
  updateUrllineRender();
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

function insertUrllineText(text) {
  insertUrllineTextAtCursor(state, text);
}

function submitUrlline() {
  const targetPane = state.urllinePane === "right" ? "right" : "left";
  const rawInput = String(state.urllineBuffer || "").trim();
  stopUrllineEdit();

  if (!rawInput) {
    return;
  }

  const target = resolveInputTarget(rawInput, {
    defaultSearchEngine: "duckduckgo",
  });

  if (target.kind === "invalid") {
    return;
  }

  buffers.focusPane(targetPane);
  const paneBuffer = buffers.getPaneBuffer(targetPane);
  if (!paneBuffer || paneBuffer.isEditable) {
    return;
  }

  paneBuffer.load(target.url);
}

function handleUrllineInput(event, input) {
  if (typeof input.pasteText === "string" && input.pasteText.length > 0) {
    insertUrllineText(input.pasteText);
    updateUrllineRender();
    return;
  }

  if (input.key === "Escape") {
    stopUrllineEdit();
    return;
  }

  if (input.key === "Enter") {
    submitUrlline();
    return;
  }

  if (input.key === "Left" || input.key === "ArrowLeft") {
    moveUrllineCursor(state, -1);
    updateUrllineRender();
    return;
  }

  if (input.key === "Right" || input.key === "ArrowRight") {
    moveUrllineCursor(state, 1);
    updateUrllineRender();
    return;
  }

  if (input.key === "Home") {
    setUrllineCursor(state, 0);
    updateUrllineRender();
    return;
  }

  if (input.key === "End") {
    setUrllineCursor(state, state.urllineBuffer.length);
    updateUrllineRender();
    return;
  }

  if (input.key === "Backspace") {
    if (!deleteUrllineBackward(state)) {
      return;
    }
    updateUrllineRender();
    return;
  }

  if (input.key === "Delete") {
    if (!deleteUrllineForward(state)) {
      return;
    }
    updateUrllineRender();
    return;
  }

  if (!input.ctrl && !input.meta && !input.alt) {
    if (input.key === "Space") {
      insertUrllineText(" ");
      updateUrllineRender();
      return;
    }

    if (typeof input.key === "string" && input.key.length === 1) {
      insertUrllineText(input.key);
      updateUrllineRender();
    }
  }
}


function createWindow() {
  const config = configService.initConfig();
  state.applyConfig(config);
  applyBrowserLanguagePreference();
  const initialWidth = configService.getConfigValue("global.window.width", 1200);
  const initialHeight = configService.getConfigValue("global.window.height", 800);
  const initialX = configService.getConfigValue("global.window.x", null);
  const initialY = configService.getConfigValue("global.window.y", null);
  const initialIsMaximized = configService.getConfigValue("global.window.is_maximized", false);

  const isMac = process.platform === "darwin";

  const windowOptions = {
    width: initialWidth,
    height: initialHeight,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      preload: path.join(__dirname, "ui", "shell", "preload.js"),
    },
  };

  if (isMac) {
    windowOptions.titleBarStyle = "hiddenInset";
  } else {
    windowOptions.frame = false;
  }

  const hasConfiguredPosition = isFiniteInteger(initialX) && isFiniteInteger(initialY);
  if (hasConfiguredPosition) {
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

  win = new BrowserWindow(windowOptions);
  markSurfaceRole(win.webContents, SURFACE_ROLES.TRUSTED_SHELL);

  win.setMaxListeners(0);

  win.webContents.on("before-input-event", (event, input) => {
    handleRawInput(event, input);
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
    historyPanel,
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
  });

  buffers.init(win);
  buffers.setUrllineVisible(configService.getConfigValue("global.ui.urlline.enabled", false));
  historyPanel.init({ window: win, buffers, state });
  historyPanel.setOnFocusChange(() => {
    uiShell.updateStatuslineMode(getStatuslineModeLabel());
    updateTablineOptions();
  });
  historyPanel.setWidthRatio(configService.getConfigValue("global.ui.sidepanel.width_ratio", 0.2));
  historyPanel.setTreeScrollContextLines(
    configService.getConfigValue("global.ui.sidepanel.tree_scroll_context_lines", 3),
  );
  historyPanel.setTreeDeleteOperatorTimeoutMs(
    configService.getConfigValue("global.ui.sidepanel.delete_operator_timeout_ms", 900),
  );
  const historyPanelWebContents = historyPanel.getWebContents();
  if (historyPanelWebContents) {
    historyPanelWebContents.on("before-input-event", (event, input) => {
      handleRawInput(event, input);
    });
  }
  uiShell.init(win);
  smokeScenarios = createSmokeScenarios({
    app,
    win,
    fs,
    state,
    buffers,
    dispatch,
    INTENTS,
    configService,
    historyPanel,
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

  wireWindowLifecycle({
    win,
    uiShell,
    buffers,
    historyPanel,
    updateUrllineRender,
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
    uiShell.updateStatuslineMode(getStatuslineModeLabel());
    uiShell.updateStatuslineSplitIndicator(buffers.getSplitStatus());
    uiShell.updateSplitDivider(buffers.getSplitStatus());

    if (activeChanged || inputCoordinator.getActiveInputWebContents() !== active.webContents) {
      inputCoordinator.bindInputToActiveBuffer();
    }

    if (change.activeChanged) {
      uiShell.syncOverlayStack();
    } else if (uiShell.isCommandVisible()) {
      uiShell.keepCommandOverlayAboveContentViews();
    }

    if (change.kind === "pane-interaction" && historyPanel.isFocused()) {
      historyPanel.unfocus();
      updateTablineOptions();
      uiShell.updateStatuslineMode(getStatuslineModeLabel());
    }

    if (change.kind === "visit" && change.url) {
      const normalizedUrl = normalizeHistoryUrl(change.url);
      if (!normalizedUrl) {
        return;
      }

      const nowMs = Number.isFinite(change.timestampMs) ? change.timestampMs : Date.now();
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
      if (historyPanel.isVisible()) {
        historyPanel.reloadData();
        historyPanel.render();
      }
    }

    if (change.kind === "title-updated" && change.url && change.title) {
      const normalizedUrl = normalizeHistoryUrl(change.url);
      if (!normalizedUrl) {
        return;
      }
      historyService.updateLatestTitleForUrl(normalizedUrl, change.title);
      if (historyPanel.isVisible()) {
        historyPanel.reloadData();
        historyPanel.render();
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
    const shouldApplyFromSystem =
      themeContext.configuredMode === "auto" ||
      themeContext.contentMode === "auto" ||
      (themeContext.contentMode === "match" && themeContext.configuredMode === "custom");
    if (!shouldApplyFromSystem) {
      return;
    }

    applyTheme(themeContext, { broadcast: true });
    updateTablineActions();
    updateTablineOptions();
    updateUrllineActions();
    updateUrllineRender();
  };

  nativeTheme.on("updated", onNativeThemeUpdated);

  win.on("closed", () => {
    nativeTheme.removeListener("updated", onNativeThemeUpdated);
  });
}

app.whenReady().then(() => {
  registerSessionSecurityPolicyAdapter({ session });
  registerWebContentsSecurityPolicyAdapter({
    app,
    isAllowedNavigationUrl,
    notificationsService,
  });
  createWindow();
  if (smokeScenarios) {
    smokeScenarios.maybeScheduleSmokeExit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

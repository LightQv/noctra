const path = require("path");
const fs = require("fs");
const {
  app,
  BrowserWindow,
  ipcMain,
  clipboard,
  nativeTheme,
  screen,
  session,
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
let win;
let smokeScenarios = null;

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
  toCssVars,
  buffers,
  uiShell,
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

function handleRawInput(event, input) {
  const normalized = normalizeInput(input);
  const focusSnapshot = resolveFocusSnapshot({
    state,
    buffers,
    historyPanel,
    bookmarkInsertScopeModal,
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
        focusSnapshot.historyPanelVisible
      ) {
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

  if (
    priority.shouldRouteFocusedTreeInput &&
    historyPanel.handleFocusedInput(normalized)
  ) {
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
        historyPanel.isFocused() ||
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
    showFavicon: configService.getConfigValue(
      "global.ui.tabline.show_favicon",
      false,
    ),
    dimActiveBuffer: historyPanel.isFocused(),
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
  historyPanel,
  resolveCurrentTheme,
  applyTheme,
  uiShell,
  updateTablineActions,
  updateTablineOptions,
  updateUrllineActions,
  updateUrllineRender,
});

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
    historyPanel,
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
}

app.whenReady().then(() => {
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
  createWindow();
  if (smokeScenarios) {
    smokeScenarios.maybeScheduleSmokeExit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

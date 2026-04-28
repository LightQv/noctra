const path = require("path");
const fs = require("fs");
const { app, BrowserWindow, ipcMain, clipboard, nativeTheme, screen } = require("electron");
const buffers = require("./browser/manager");
const { handleInput, shouldPreventDefault } = require("./core/input");
const state = require("./core/state");
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
let win;
let activeInputWebContents = null;
let inputListener = null;

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
    broadcastUiShellPush("theme:update", payload);
  }
}

function broadcastUiShellPush(type, payload = {}) {
  if (!win || typeof type !== "string" || !type.length) return;

  const targets = new Map();
  const addTarget = (webContents) => {
    if (!webContents || webContents.isDestroyed()) return;
    targets.set(webContents.id, webContents);
  };

  addTarget(win.webContents);
  for (const webContents of buffers.getAllWebContents()) {
    addTarget(webContents);
  }

  for (const webContents of targets.values()) {
    webContents.send("ui-shell:push", { type, payload });
  }
}

function focusActiveEditorSurface(options = {}) {
  const forceNormal = Boolean(options.forceNormal);
  const active = buffers.getActive();
  if (!active || !active.isEditable || !active.webContents || active.webContents.isDestroyed()) {
    return;
  }

  buffers.focusActive();
  active.webContents.executeJavaScript(
    `
      if (${JSON.stringify(forceNormal)} && typeof window.__settingsEditorSetNormal__ === "function") {
        window.__settingsEditorSetNormal__();
      }
      if (typeof window.__settingsEditorFocus__ === "function") {
        window.__settingsEditorFocus__();
      }
    `,
  ).catch(() => {});
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

  const isUrllinePasteShortcut =
    state.urllineEditing &&
    normalized.type === "keyDown" &&
    (normalized.key === "v" || normalized.key === "V") &&
    ((process.platform === "darwin" && normalized.meta && !normalized.ctrl) ||
      (process.platform !== "darwin" && normalized.ctrl && !normalized.meta));

  if (isUrllinePasteShortcut) {
    event.preventDefault();
    handleUrllineInput(event, {
      ...normalized,
      pasteText: clipboard.readText(),
    });
    return;
  }

  if (state.urllineEditing) {
    event.preventDefault();
    handleUrllineInput(event, normalized);
    return;
  }

  const isCommandPasteShortcut =
    state.mode === "COMMAND" &&
    normalized.type === "keyDown" &&
    (normalized.key === "v" || normalized.key === "V") &&
    ((process.platform === "darwin" && normalized.meta && !normalized.ctrl) ||
      (process.platform !== "darwin" && normalized.ctrl && !normalized.meta));

  if (isCommandPasteShortcut) {
    event.preventDefault();
    handleInput(win, {
      ...normalized,
      pasteText: clipboard.readText(),
    });
    return;
  }

  const isOpenSettingsShortcut =
    normalized.type === "keyDown" &&
    (normalized.key === "," || normalized.key === "Comma") &&
    ((process.platform === "darwin" && normalized.meta) ||
      (process.platform !== "darwin" && normalized.ctrl));

  if (isOpenSettingsShortcut) {
    event.preventDefault();
    dispatch(win, { type: INTENTS.OPEN_SETTINGS_BUFFER }, state);
    return;
  }

  if (shouldPreventDefault(normalized)) {
    event.preventDefault();
  }

  handleInput(win, normalized);
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
  for (const [keys, node] of Object.entries(normalMap)) {
    if (node && node.action === targetAction) {
      hits.push(keys);
    }
  }
  return hits;
}

function findCtrlMappingsForAction(ctrlMap, targetAction) {
  if (!ctrlMap || typeof ctrlMap !== "object") {
    return [];
  }

  const hits = [];
  for (const [key, node] of Object.entries(ctrlMap)) {
    if (node && node.action === targetAction) {
      hits.push(`Ctrl+${String(key).toUpperCase()}`);
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
  const normal = configService.getConfigValue("keymap.normal", {});
  const ctrl = configService.getConfigValue("keymap.ctrl", {});
  const leader = configService.getConfigValue("keymap.leader", {});

  const labels = [];
  const normalHits = findNormalMappingsForAction(normal, actionId);
  if (normalHits.length > 0) {
    labels.push(normalHits[0]);
  }

  const ctrlHits = findCtrlMappingsForAction(ctrl, actionId);
  if (ctrlHits.length > 0) {
    labels.push(ctrlHits[0]);
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
  });
}

function updateTablineOptions() {
  uiShell.setTablineOptions({
    showFavicon: configService.getConfigValue("global.ui.tabline.show_favicon", false),
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

function getStatuslineModeLabel() {
  const active = buffers.getActive();
  if (!active || !active.isEditable) {
    return state.mode;
  }

  if (state.interactionContext === "EDITOR") {
    return `EDITOR:${state.editorMode || "NORMAL"}`;
  }

  return `SHELL:${state.mode}`;
}

function clampUrllineCursor() {
  const max = state.urllineBuffer.length;
  const index = Number.isFinite(state.urllineCursorIndex)
    ? Math.trunc(state.urllineCursorIndex)
    : max;
  state.urllineCursorIndex = Math.max(0, Math.min(index, max));
}

function startUrllineEdit(pane, initialUrl) {
  state.urllineEditing = true;
  state.urllinePane = pane === "right" ? "right" : "left";
  state.urllineBuffer = String(initialUrl || "");
  state.urllineCursorIndex = state.urllineBuffer.length;
  state.mode = "INSERT";
  uiShell.updateStatuslineMode(getStatuslineModeLabel());
  updateUrllineRender();
}

function stopUrllineEdit() {
  state.urllineEditing = false;
  state.urllinePane = "left";
  state.urllineBuffer = "";
  state.urllineCursorIndex = 0;
  state.mode = "NORMAL";
  uiShell.updateStatuslineMode(getStatuslineModeLabel());
  updateUrllineRender();
}

function normalizeUrllineText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\r\n|\r|\n/g, " ");
}

function insertUrllineText(text) {
  const chunk = normalizeUrllineText(text);
  if (!chunk) {
    return;
  }
  clampUrllineCursor();
  const cursor = state.urllineCursorIndex;
  state.urllineBuffer =
    state.urllineBuffer.slice(0, cursor) +
    chunk +
    state.urllineBuffer.slice(cursor);
  state.urllineCursorIndex = cursor + chunk.length;
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
    clampUrllineCursor();
    state.urllineCursorIndex = Math.max(0, state.urllineCursorIndex - 1);
    updateUrllineRender();
    return;
  }

  if (input.key === "Right" || input.key === "ArrowRight") {
    clampUrllineCursor();
    state.urllineCursorIndex = Math.min(state.urllineBuffer.length, state.urllineCursorIndex + 1);
    updateUrllineRender();
    return;
  }

  if (input.key === "Home") {
    state.urllineCursorIndex = 0;
    updateUrllineRender();
    return;
  }

  if (input.key === "End") {
    state.urllineCursorIndex = state.urllineBuffer.length;
    updateUrllineRender();
    return;
  }

  if (input.key === "Backspace") {
    clampUrllineCursor();
    if (state.urllineCursorIndex <= 0) {
      return;
    }

    const cursor = state.urllineCursorIndex;
    state.urllineBuffer =
      state.urllineBuffer.slice(0, cursor - 1) +
      state.urllineBuffer.slice(cursor);
    state.urllineCursorIndex = cursor - 1;
    updateUrllineRender();
    return;
  }

  if (input.key === "Delete") {
    clampUrllineCursor();
    const cursor = state.urllineCursorIndex;
    if (cursor >= state.urllineBuffer.length) {
      return;
    }

    state.urllineBuffer =
      state.urllineBuffer.slice(0, cursor) +
      state.urllineBuffer.slice(cursor + 1);
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

function registerUiShellEvents() {
  const onShellEvent = (event, message) => {
    if (!win) return;
    const sender = event.sender;
    const fromShellHost = sender === win.webContents;
    const fromActiveBuffer = sender === buffers.getActiveWebContents();
    if (!fromShellHost && !fromActiveBuffer) return;
    if (!message || typeof message !== "object") return;

    const { type, payload } = message;

    if (type === "window:action") {
      const action = payload?.action;

      if (action === "minimize") {
        win.minimize();
        return;
      }

      if (action === "toggleMaximize") {
        if (win.isMaximized()) {
          win.unmaximize();
        } else {
          win.maximize();
        }
        return;
      }

      if (action === "close") {
        win.close();
      }
      return;
    }

    if (type === "tabline:open-settings") {
      dispatch(win, { type: INTENTS.OPEN_SETTINGS_BUFFER }, state);
      return;
    }

    if (type === "tabline:new-tab") {
      dispatch(win, { type: INTENTS.NEW_BUFFER }, state);
      return;
    }

    if (type === "editor:toggle-context") {
      dispatch(win, { type: INTENTS.TOGGLE_FOCUS_CONTEXT }, state);
      uiShell.updateStatuslineMode(getStatuslineModeLabel());
      return;
    }

    if (type === "editor:mode-change") {
      const nextMode =
        payload?.mode === "INSERT" || payload?.mode === "NORMAL"
          ? payload.mode
          : "NORMAL";
      state.editorMode = nextMode;
      uiShell.updateStatuslineMode(getStatuslineModeLabel());
      return;
    }

    if (type === "editor:focus-request") {
      state.interactionContext = "EDITOR";
      focusActiveEditorSurface();
      uiShell.updateStatuslineMode(getStatuslineModeLabel());
      return;
    }

    if (type === "editor:open-command") {
      const initialText =
        typeof payload?.initialText === "string" ? payload.initialText : "";
      state.mode = "COMMAND";
      state.commandTarget = "EDITOR";
      state.commandBuffer = initialText;
      state.commandCursorIndex = initialText.length;
      dispatch(win, { type: INTENTS.SHOW_COMMAND }, state);
      dispatch(win, { type: INTENTS.COMMAND_INPUT }, state);
      return;
    }

    if (type === "editor:ready") {
      state.interactionContext = "EDITOR";
      state.editorMode = "NORMAL";
      focusActiveEditorSurface({ forceNormal: true });
      uiShell.updateStatuslineMode(getStatuslineModeLabel());
      return;
    }

    if (type === "urlline:start-edit") {
      const pane = payload?.pane === "right" ? "right" : "left";
      buffers.focusPane(pane);
      const paneBuffer = buffers.getPaneBuffer(pane);
      if (!paneBuffer || paneBuffer.isEditable) {
        return;
      }
      startUrllineEdit(pane, paneBuffer.url || "about:blank");
      return;
    }

    if (type === "urlline:action") {
      const pane = payload?.pane === "right" ? "right" : "left";
      const action = payload?.action;
      const paneBuffer = buffers.getPaneBuffer(pane);
      if (!paneBuffer || paneBuffer.isEditable) {
        return;
      }

      buffers.focusPane(pane);

      if (action === "back") {
        paneBuffer.webContents.navigationHistory.goBack();
        return;
      }

      if (action === "forward") {
        paneBuffer.webContents.navigationHistory.goForward();
        return;
      }

      if (action === "reload") {
        paneBuffer.webContents.reload();
      }
      return;
    }

    const bufferId = Number.parseInt(payload?.id, 10);

    if (!Number.isInteger(bufferId)) return;

    if (type === "tab:activate") {
      buffers.switchTo(bufferId);
      return;
    }

    if (type === "tab:close") {
      buffers.close(bufferId);
    }
  };

  ipcMain.on("ui-shell:event", onShellEvent);

  const onShellRequest = async (event, message) => {
    if (!win || event.sender !== buffers.getActiveWebContents()) return { ok: false };
    if (!message || typeof message !== "object") return { ok: false };

    const { type, payload } = message;

    if (type === "settings:get") {
      const configPath = configService.getConfigPath();
      try {
        const content = fs.readFileSync(configPath, "utf8");
        const themeContext = resolveCurrentTheme();
        return {
          ok: true,
          content,
          leaderKey: configService.getConfigValue("global.input.leader_key", "Space"),
          relativeLineNumbers: configService.getConfigValue(
            "global.editor.relative_line_numbers",
            true,
          ),
          scrolloffLines: configService.getConfigValue("global.editor.scrolloff_lines", 3),
          ...buildThemePayload(themeContext),
        };
      } catch (error) {
        return { ok: false, error: error.message };
      }
    }

    if (type === "settings:save") {
      const configPath = configService.getConfigPath();
      try {
        fs.writeFileSync(configPath, String(payload?.content || ""), "utf8");
        const config = configService.reloadConfig();
        state.applyConfig(config);
        buffers.setUrllineVisible(configService.getConfigValue("global.ui.urlline.enabled", false));
        buffers.layoutViews();
        const themeContext = resolveCurrentTheme();
        applyTheme(themeContext, { broadcast: true });
        uiShell.updateSplitDivider(buffers.getSplitStatus());
        updateTablineActions();
        updateTablineOptions();
        updateUrllineActions();
        updateUrllineRender();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error.message };
      }
    }

    if (type === "settings:close") {
      dispatch(win, { type: INTENTS.CLOSE_BUFFER }, state);
      return { ok: true };
    }

    return { ok: false };
  };

  ipcMain.handle("ui-shell:request", onShellRequest);

  win.on("closed", () => {
    ipcMain.removeListener("ui-shell:event", onShellEvent);
    ipcMain.removeHandler("ui-shell:request");
  });
}

function bindInputToActiveBuffer() {
  const nextWebContents = buffers.getActiveWebContents();
  if (!nextWebContents) return;

  if (activeInputWebContents === nextWebContents) {
    buffers.focusActive();
    return;
  }

  if (activeInputWebContents && inputListener) {
    activeInputWebContents.removeListener("before-input-event", inputListener);
  }

  inputListener = (event, input) => {
    handleRawInput(event, input);
  };

  nextWebContents.on("before-input-event", inputListener);
  activeInputWebContents = nextWebContents;
  buffers.focusActive();
}

function createWindow() {
  const config = configService.initConfig();
  state.applyConfig(config);
  const chromiumPreferences = configService.getConfigValue("browser.chromium.web_preferences", {});
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
      contextIsolation:
        typeof chromiumPreferences.context_isolation === "boolean"
          ? chromiumPreferences.context_isolation
          : true,
      nodeIntegration:
        typeof chromiumPreferences.node_integration === "boolean"
          ? chromiumPreferences.node_integration
          : false,
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

  win.setMaxListeners(0);

  win.webContents.on("before-input-event", (event, input) => {
    handleRawInput(event, input);
  });

  win.webContents.on("did-finish-load", () => {
    buffers.focusActive();
  });

  registerUiShellEvents();

  buffers.init(win);
  buffers.setUrllineVisible(configService.getConfigValue("global.ui.urlline.enabled", false));
  uiShell.init(win);
  applyTheme(resolveCurrentTheme());
  uiShell.setWindowChrome({
    platform: process.platform,
    useNativeControls: isMac,
    isMaximized: win.isMaximized(),
    isFullScreen: win.isFullScreen(),
  });
  uiShell.updateStatuslineMode(state.mode);
  uiShell.updateStatuslineScroll(0);
  uiShell.updateStatuslineSplitIndicator(buffers.getSplitStatus());
  uiShell.updateSplitDivider(buffers.getSplitStatus());
  updateTablineActions();
  updateTablineOptions();
  updateUrllineActions();
  updateUrllineRender();

  const syncWindowChrome = () => {
    uiShell.setWindowChrome({
      isMaximized: win.isMaximized(),
      isFullScreen: win.isFullScreen(),
    });
    updateUrllineRender();
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
      if (!win || win.isDestroyed() || win.isMaximized() || win.isFullScreen()) {
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
    uiShell.updateSplitDivider(buffers.getSplitStatus());
    updateUrllineRender();
    persistWindowBoundsDebounced();
  });

  win.on("move", () => {
    persistWindowBoundsDebounced();
  });

  if (initialIsMaximized) {
    win.maximize();
  }

  let statusPollInFlight = false;

  const statusPoller = setInterval(() => {
    const activeBuffer = buffers.getActive();
    if (!activeBuffer || state.mode === "COMMAND") {
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

    activeWebContents
      .executeJavaScript(
        `
        (function getScrollPercent() {
          const doc = document.documentElement;
          const body = document.body;
          const top = window.scrollY || doc.scrollTop || body.scrollTop || 0;
          const scrollHeight = Math.max(doc.scrollHeight || 0, body.scrollHeight || 0);
          const clientHeight = Math.max(doc.clientHeight || 0, window.innerHeight || 0);
          const range = Math.max(scrollHeight - clientHeight, 1);
          return Math.max(0, Math.min(100, Math.round((top / range) * 100)));
        })();
      `,
      )
      .then((percent) => {
        if (typeof percent === "number") {
          uiShell.updateStatuslineScroll(percent);
        }
      })
      .catch(() => {})
      .finally(() => {
        statusPollInFlight = false;
      });
  }, 200);

  win.on("close", () => {
    flushWindowBoundsPersistence();
  });

  win.on("closed", () => {
    if (persistWindowBoundsTimer) {
      clearTimeout(persistWindowBoundsTimer);
      persistWindowBoundsTimer = null;
    }
    clearInterval(statusPoller);
  });

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

    if (activeChanged || activeInputWebContents !== active.webContents) {
      bindInputToActiveBuffer();
    }

    if (change.activeChanged) {
      uiShell.syncOverlayStack();
    } else if (uiShell.isCommandVisible()) {
      uiShell.keepCommandOverlayAboveContentViews();
    }
  });

  buffers.openConfiguredBuffer();
  bindInputToActiveBuffer();

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

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

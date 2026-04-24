const path = require("path");
const fs = require("fs");
const { app, BrowserWindow, ipcMain } = require("electron");
const buffers = require("./browser/manager");
const { handleInput, shouldPreventDefault } = require("./core/input");
const state = require("./core/state");
const configService = require("./core/config/service");
const uiShell = require("./ui/shell/manager");
const { dispatch } = require("./core/dispatcher");
const { INTENTS } = require("./core/intents");
const { resolveTheme, toCssVars } = require("./ui/theme");
let win;
let activeInputWebContents = null;
let inputListener = null;

function resolveCurrentTheme() {
  return resolveTheme(configService.getConfigValue("theme", {}));
}

function buildThemePayload(theme) {
  return {
    theme,
    themeVars: toCssVars(theme),
  };
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

function formatLeaderSequence(seq = []) {
  if (!Array.isArray(seq) || seq.length === 0) return null;
  const rendered = seq.map((part) => (part === "tab" ? "Tab" : part)).join(" ");
  return `<leader> ${rendered}`;
}

function updateTablineActions() {
  const leaderTree = configService.getConfigValue("keymap.leader", {});
  const openSettingsSeqs = findLeaderSequencesForAction(leaderTree, "open_settings");
  const vimShortcut = formatLeaderSequence(openSettingsSeqs[0]) || "<leader> ,";
  const systemShortcut = process.platform === "darwin" ? "Cmd+," : "Ctrl+,";

  uiShell.setTablineActions({
    settings: {
      label: "Config",
      icon: "󰒓",
      shortcutLabel: `${systemShortcut} | ${vimShortcut}`,
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

    if (type === "editor:ready") {
      state.interactionContext = "EDITOR";
      state.editorMode = "NORMAL";
      focusActiveEditorSurface({ forceNormal: true });
      uiShell.updateStatuslineMode(getStatuslineModeLabel());
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
        const theme = resolveCurrentTheme();
        return {
          ok: true,
          content,
          leaderKey: configService.getConfigValue("input.leader_key", "Space"),
          relativeLineNumbers: configService.getConfigValue("editor.relative_line_numbers", true),
          ...buildThemePayload(theme),
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
        const theme = resolveCurrentTheme();
        uiShell.setTheme(theme);
        broadcastUiShellPush("theme:update", buildThemePayload(theme));
        updateTablineActions();
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

  const isMac = process.platform === "darwin";

  const windowOptions = {
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "ui", "shell", "preload.js"),
    },
  };

  if (isMac) {
    windowOptions.titleBarStyle = "hiddenInset";
  } else {
    windowOptions.frame = false;
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
  uiShell.init(win);
  uiShell.setTheme(resolveCurrentTheme());
  uiShell.setWindowChrome({
    platform: process.platform,
    useNativeControls: isMac,
    isMaximized: win.isMaximized(),
    isFullScreen: win.isFullScreen(),
  });
  uiShell.updateStatuslineMode(state.mode);
  uiShell.updateStatuslineScroll(0);
  uiShell.updateStatuslineSplitIndicator(buffers.getSplitStatus());
  updateTablineActions();

  const syncWindowChrome = () => {
    uiShell.setWindowChrome({
      isMaximized: win.isMaximized(),
      isFullScreen: win.isFullScreen(),
    });
  };

  win.on("maximize", syncWindowChrome);
  win.on("unmaximize", syncWindowChrome);
  win.on("enter-full-screen", syncWindowChrome);
  win.on("leave-full-screen", syncWindowChrome);

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

  win.on("closed", () => {
    clearInterval(statusPoller);
  });

  buffers.subscribe((snapshot, active, change = {}) => {
    if (!active) return;

    const activeChanged = Boolean(change.activeChanged);

    uiShell.renderTabline(snapshot);
    uiShell.updateStatuslineMode(getStatuslineModeLabel());
    uiShell.updateStatuslineSplitIndicator(buffers.getSplitStatus());

    if (activeChanged || activeInputWebContents !== active.webContents) {
      bindInputToActiveBuffer();
    }

    if (change.activeChanged) {
      uiShell.syncOverlayStack();
    } else if (uiShell.isCommandVisible()) {
      uiShell.keepCommandOverlayAboveContentViews();
    }
  });

  buffers.create("https://anime-sama.to/");
  bindInputToActiveBuffer();
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

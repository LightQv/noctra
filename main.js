const path = require("path");
const { app, BrowserWindow, ipcMain } = require("electron");
const buffers = require("./browser/manager");
const { handleInput, shouldPreventDefault } = require("./core/input");
const state = require("./core/state");
const configService = require("./core/config/service");
const uiShell = require("./ui/shell/manager");

let win;
let activeInputWebContents = null;
let inputListener = null;

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

  if (shouldPreventDefault(normalized)) {
    event.preventDefault();
  }

  handleInput(win, normalized);
}

function registerUiShellEvents() {
  const onShellEvent = (event, message) => {
    if (!win || event.sender !== win.webContents) return;
    if (!message || typeof message !== "object") return;

    const { type, payload } = message;
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

  win.on("closed", () => {
    ipcMain.removeListener("ui-shell:event", onShellEvent);
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

  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "ui", "shell", "preload.js"),
    },
  });

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
  uiShell.updateStatuslineMode(state.mode);
  uiShell.updateStatuslineScroll(0);

  const statusPoller = setInterval(() => {
    const activeBuffer = buffers.getActive();
    if (!activeBuffer || state.mode === "COMMAND") {
      return;
    }

    activeBuffer.webContents
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
      .catch(() => {});
  }, 200);

  win.on("closed", () => {
    clearInterval(statusPoller);
  });

  buffers.subscribe((snapshot, active, change = {}) => {
    if (!active) return;

    uiShell.renderTabline(snapshot);
    uiShell.updateStatuslineMode(state.mode);

    const activeChanged = Boolean(change.activeChanged);
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

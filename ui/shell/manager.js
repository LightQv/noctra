const { BrowserView } = require("electron");
const { renderTabline } = require("../tabline");
const { UI_SHELL_TABLINE_HEIGHT, UI_SHELL_STATUSLINE_HEIGHT } = require("../constants");

const SHELL_HTML = `
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      html,
      body {
        margin: 0;
        width: 100%;
        height: 100%;
        background: #0f131a;
        overflow: hidden;
      }
    </style>
  </head>
  <body></body>
</html>
`;

const COMMAND_OVERLAY_HTML = `
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      html,
      body {
        margin: 0;
        width: 100%;
        height: 100%;
        background: transparent;
        overflow: hidden;
        pointer-events: none;
      }

      #command-overlay {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 14px;
        border-radius: 8px;
        border: 1px solid #2f3440;
        background: #1e232d;
        color: #f4f7ff;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 14px;
        line-height: 1;
        box-sizing: border-box;
      }

      #command-prefix {
        color: #9eb1d9;
      }

      #command-text {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    </style>
  </head>
  <body>
    <div id="command-overlay">
      <span id="command-prefix">:</span>
      <span id="command-text"></span>
    </div>
  </body>
</html>
`;

const WHICHKEY_OVERLAY_HTML = `
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      html,
      body {
        margin: 0;
        width: 100%;
        height: 100%;
        background: transparent;
        overflow: hidden;
        pointer-events: none;
      }

      #whichkey-overlay {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 10px 12px;
        border-radius: 8px;
        border: 1px solid #2f3440;
        background: #161b24;
        color: #f2f6ff;
        box-sizing: border-box;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      }

      #whichkey-prefix {
        color: #8da3d4;
        font-size: 12px;
      }

      #whichkey-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
      }

      .whichkey-entry {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        border-radius: 6px;
        background: #232a38;
      }

      .whichkey-key {
        color: #d8e5ff;
        min-width: 70px;
      }

      .whichkey-label {
        color: #b6c7e8;
      }
    </style>
  </head>
  <body>
    <div id="whichkey-overlay">
      <div id="whichkey-prefix"></div>
      <div id="whichkey-grid"></div>
    </div>
  </body>
</html>
`;

const STATUSLINE_OVERLAY_HTML = `
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      html,
      body {
        margin: 0;
        width: 100%;
        height: 100%;
        background: transparent;
        overflow: hidden;
        pointer-events: none;
      }

      #statusline {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 12px;
        box-sizing: border-box;
        background: #151a22;
        border-top: 1px solid #2a3140;
        color: #d8e3f8;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 12px;
      }

      #statusline-mode {
        color: #a8bde8;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }

      #statusline-scroll {
        color: #d8e3f8;
      }
    </style>
  </head>
  <body>
    <div id="statusline">
      <span id="statusline-mode">NORMAL</span>
      <span id="statusline-scroll">0%</span>
    </div>
  </body>
</html>
`;

class UiShellManager {
  constructor() {
    this.window = null;
    this.shellHostReady = false;
    this.commandOverlayView = null;
    this.commandOverlayReady = false;
    this.commandVisible = false;
    this.commandText = "";
    this.whichKeyOverlayView = null;
    this.whichKeyOverlayReady = false;
    this.whichKeyVisible = false;
    this.whichKeyModel = { prefix: "<leader>", entries: [] };
    this.whichKeyHideTimer = null;
    this.whichKeyShowTimer = null;
    this.whichKeyPendingTimeoutMs = 1200;
    this.statuslineView = null;
    this.statuslineReady = false;
    this.statuslineMode = "NORMAL";
    this.statuslineScroll = 0;
    this.pendingTablineSnapshot = [];
    this.tablineRenderTimer = null;
  }

  init(windowRef) {
    this.window = windowRef;
    this.shellHostReady = false;
    this.pendingTablineSnapshot = [];

    this.initializeShellHost();
    this.initializeCommandOverlayView();
    this.initializeWhichKeyOverlayView();
    this.initializeStatuslineView();

    this.window.on("resize", () => this.relayout());
    this.window.on("maximize", () => this.relayout());
    this.window.on("unmaximize", () => this.relayout());
  }

  initializeShellHost() {
    if (!this.window) return;

    this.window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(SHELL_HTML)}`);

    this.window.webContents.on("did-finish-load", () => {
      this.shellHostReady = true;
      this.renderTabline(this.pendingTablineSnapshot);
    });
  }

  initializeCommandOverlayView() {
    if (!this.window) return;

    this.commandOverlayView = new BrowserView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    this.commandOverlayView.setAutoResize({ width: false, height: false });
    this.commandOverlayView.webContents.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(COMMAND_OVERLAY_HTML)}`,
    );

    this.commandOverlayView.webContents.on("did-finish-load", () => {
      this.commandOverlayReady = true;
      this.updateCommand(this.commandText);
    });

    this.window.addBrowserView(this.commandOverlayView);
    this.relayout();
  }

  initializeWhichKeyOverlayView() {
    if (!this.window) return;

    this.whichKeyOverlayView = new BrowserView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    this.whichKeyOverlayView.setAutoResize({ width: false, height: false });
    this.whichKeyOverlayView.webContents.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(WHICHKEY_OVERLAY_HTML)}`,
    );

    this.whichKeyOverlayView.webContents.on("did-finish-load", () => {
      this.whichKeyOverlayReady = true;
      this.updateWhichKey(this.whichKeyModel, null, 0, false, true);
    });

    this.window.addBrowserView(this.whichKeyOverlayView);
    this.relayout();
  }

  initializeStatuslineView() {
    if (!this.window) return;

    this.statuslineView = new BrowserView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    this.statuslineView.setAutoResize({ width: true, height: false });
    this.statuslineView.webContents.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(STATUSLINE_OVERLAY_HTML)}`,
    );

    this.statuslineView.webContents.on("did-finish-load", () => {
      this.statuslineReady = true;
      this.updateStatuslineMode(this.statuslineMode);
      this.updateStatuslineScroll(this.statuslineScroll);
    });

    this.window.addBrowserView(this.statuslineView);
    this.relayout();
  }

  renderTabline(snapshot) {
    this.pendingTablineSnapshot = snapshot;

    if (!this.window || !this.shellHostReady) return;

    if (this.tablineRenderTimer) {
      return;
    }

    this.tablineRenderTimer = setTimeout(() => {
      this.tablineRenderTimer = null;
      if (!this.window || this.window.isDestroyed()) return;
      renderTabline(this.window.webContents, this.pendingTablineSnapshot);
    }, 16);
  }

  getContentTopInset() {
    return UI_SHELL_TABLINE_HEIGHT;
  }

  relayout() {
    if (!this.window || !this.commandOverlayView || !this.whichKeyOverlayView || !this.statuslineView)
      return;

    const bounds = this.window.getContentBounds();
    const width = this.commandVisible ? Math.min(560, Math.max(bounds.width - 40, 320)) : 1;
    const height = this.commandVisible ? 52 : 1;
    const x = this.commandVisible ? Math.max(Math.floor((bounds.width - width) / 2), 0) : -10000;
    const y = this.commandVisible
      ? Math.max(Math.floor((bounds.height - height) / 2), UI_SHELL_TABLINE_HEIGHT + 10)
      : -10000;

    this.commandOverlayView.setBounds({ x, y, width, height });

    const whichWidth = this.whichKeyVisible ? Math.min(760, Math.max(bounds.width - 40, 360)) : 1;
    const whichHeight = this.whichKeyVisible ? 180 : 1;
    const whichX = this.whichKeyVisible
      ? Math.max(Math.floor((bounds.width - whichWidth) / 2), 0)
      : -10000;
    const whichY = this.whichKeyVisible
      ? Math.max(
          bounds.height - UI_SHELL_STATUSLINE_HEIGHT - whichHeight - 12,
          UI_SHELL_TABLINE_HEIGHT + 12,
        )
      : -10000;

    this.whichKeyOverlayView.setBounds({
      x: whichX,
      y: whichY,
      width: whichWidth,
      height: whichHeight,
    });

    this.statuslineView.setBounds({
      x: 0,
      y: Math.max(bounds.height - UI_SHELL_STATUSLINE_HEIGHT, UI_SHELL_TABLINE_HEIGHT + 1),
      width: bounds.width,
      height: UI_SHELL_STATUSLINE_HEIGHT,
    });
  }

  hasCommandOverlayAttached() {
    if (!this.window || !this.commandOverlayView) return false;
    return this.window.getBrowserViews().includes(this.commandOverlayView);
  }

  keepCommandOverlayAboveContentViews() {
    this.syncOverlayStack();
  }

  syncOverlayStack() {
    if (!this.window || typeof this.window.setTopBrowserView !== "function") return;

    if (this.statuslineView) {
      this.window.setTopBrowserView(this.statuslineView);
    }

    if (this.whichKeyVisible && this.whichKeyOverlayView) {
      this.window.setTopBrowserView(this.whichKeyOverlayView);
    }

    if (this.commandVisible && this.commandOverlayView) {
      this.window.setTopBrowserView(this.commandOverlayView);
    }

    this.relayout();
  }

  isCommandVisible() {
    return this.commandVisible;
  }

  showCommand(text = "") {
    this.commandVisible = true;
    this.commandText = text;
    this.keepCommandOverlayAboveContentViews();
    this.updateCommand(text);
  }

  hideCommand() {
    this.commandVisible = false;
    this.commandText = "";
    this.updateCommand("");
    this.relayout();
  }

  showWhichKey(model, timeoutMs = 1200, delayMs = 0) {
    this.whichKeyModel = model || { prefix: "<leader>", entries: [] };

    if (this.whichKeyVisible || !delayMs || delayMs <= 0) {
      this.updateWhichKey(this.whichKeyModel, timeoutMs, 0, true, true);
      return;
    }

    this.whichKeyPendingTimeoutMs = timeoutMs;
    this.whichKeyVisible = false;
    this.clearWhichKeyHideTimer();
    this.resetWhichKeyShowTimer(delayMs);
  }

  updateWhichKey(model, timeoutMs = 1200, delayMs = 0, ensureVisible = true, forceImmediate = false) {
    if (ensureVisible) {
      if (!this.whichKeyVisible && !forceImmediate && delayMs && delayMs > 0) {
        this.whichKeyModel = model || this.whichKeyModel || { prefix: "<leader>", entries: [] };
        this.whichKeyPendingTimeoutMs = timeoutMs;
        this.clearWhichKeyHideTimer();
        this.resetWhichKeyShowTimer(delayMs);
        return;
      }

      this.whichKeyVisible = true;
      this.clearWhichKeyShowTimer();
    }

    this.whichKeyModel = model || this.whichKeyModel || { prefix: "<leader>", entries: [] };

    if (timeoutMs === null) {
      this.clearWhichKeyHideTimer();
    } else {
      this.resetWhichKeyHideTimer(timeoutMs);
    }

    this.syncOverlayStack();

    if (!this.whichKeyOverlayView || !this.whichKeyOverlayReady) return;

    const safeModel = {
      prefix: this.whichKeyModel.prefix || "<leader>",
      entries: Array.isArray(this.whichKeyModel.entries) ? this.whichKeyModel.entries : [],
    };

    this.whichKeyOverlayView.webContents.executeJavaScript(`
      (function updateWhichKeyOverlay() {
        const prefixNode = document.getElementById('whichkey-prefix');
        const gridNode = document.getElementById('whichkey-grid');
        if (!prefixNode || !gridNode) return;

        const model = ${JSON.stringify(safeModel)};
        prefixNode.textContent = model.prefix || '<leader>';

        const entries = Array.isArray(model.entries) ? model.entries : [];
        gridNode.innerHTML = entries
          .map((entry) => {
            const key = String(entry.key || '');
            const label = String(entry.label || '');
            return '<div class="whichkey-entry"><span class="whichkey-key">' + key + '</span><span class="whichkey-label">' + label + '</span></div>';
          })
          .join('');
      })();
    `);
  }

  hideWhichKey() {
    this.whichKeyVisible = false;
    this.clearWhichKeyShowTimer();
    this.clearWhichKeyHideTimer();
    this.relayout();
  }

  resetWhichKeyShowTimer(delayMs) {
    this.clearWhichKeyShowTimer();

    if (!delayMs || delayMs <= 0) {
      this.whichKeyVisible = true;
      this.updateWhichKey(this.whichKeyModel, this.whichKeyPendingTimeoutMs, 0, true, true);
      return;
    }

    this.whichKeyShowTimer = setTimeout(() => {
      this.whichKeyShowTimer = null;
      this.whichKeyVisible = true;
      this.updateWhichKey(this.whichKeyModel, this.whichKeyPendingTimeoutMs, 0, true, true);
    }, delayMs);
  }

  clearWhichKeyShowTimer() {
    if (!this.whichKeyShowTimer) return;
    clearTimeout(this.whichKeyShowTimer);
    this.whichKeyShowTimer = null;
  }

  resetWhichKeyHideTimer(timeoutMs) {
    this.clearWhichKeyHideTimer();

    if (!timeoutMs || timeoutMs <= 0) return;

    this.whichKeyHideTimer = setTimeout(() => {
      this.whichKeyHideTimer = null;
      this.hideWhichKey();
    }, timeoutMs);
  }

  clearWhichKeyHideTimer() {
    if (!this.whichKeyHideTimer) return;
    clearTimeout(this.whichKeyHideTimer);
    this.whichKeyHideTimer = null;
  }

  updateStatuslineMode(mode) {
    this.statuslineMode = String(mode || "NORMAL");

    if (!this.statuslineView || !this.statuslineReady) return;

    this.statuslineView.webContents.executeJavaScript(`
      (function updateStatuslineMode() {
        const node = document.getElementById('statusline-mode');
        if (!node) return;
        node.textContent = ${JSON.stringify(this.statuslineMode)};
      })();
    `);
  }

  updateStatuslineScroll(percent) {
    const normalized = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
    this.statuslineScroll = Math.round(normalized);

    if (!this.statuslineView || !this.statuslineReady) return;

    this.statuslineView.webContents.executeJavaScript(`
      (function updateStatuslineScroll() {
        const node = document.getElementById('statusline-scroll');
        if (!node) return;
        node.textContent = ${JSON.stringify(`${this.statuslineScroll}%`)};
      })();
    `);
  }

  updateCommand(text = "") {
    this.commandText = text;

    if (!this.commandOverlayView || !this.commandOverlayReady) return;

    this.commandOverlayView.webContents.executeJavaScript(`
      (function updateCommandOverlayText() {
        const textNode = document.getElementById('command-text');
        if (!textNode) return;
        textNode.textContent = ${JSON.stringify(text)};
      })();
    `);
  }
}

module.exports = new UiShellManager();

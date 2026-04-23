const { BrowserView } = require("electron");
const { renderTabline } = require("../tabline");
const {
  UI_SHELL_TABLINE_HEIGHT,
  UI_SHELL_STATUSLINE_HEIGHT,
  UI_MAIN_COLOR,
  UI_MUTED_TEXT_COLOR,
  UI_PANEL_BG_COLOR,
  UI_ACCENT_PILL_BG,
  UI_FONT_FAMILY,
  UI_FONT_FACE_CSS,
} = require("../constants");

const SHELL_HTML = `
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      ${UI_FONT_FACE_CSS}

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

      ${UI_FONT_FACE_CSS}

      #command-shell {
        width: 100%;
        height: 100%;
        margin: 0;
        min-width: 0;
        padding: 0 12px;
        border-radius: 8px;
        border: 1px solid ${UI_MAIN_COLOR};
        background: ${UI_PANEL_BG_COLOR};
        box-sizing: border-box;
        display: flex;
        align-items: center;
      }

      #command-title {
        margin: 0 auto;
        padding: 0 8px;
        color: ${UI_MUTED_TEXT_COLOR};
        font-family: ${UI_FONT_FAMILY};
        font-size: 11px;
        line-height: 1;
      }

      #command-overlay {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 0;
        top: -1px;
        color: #f4f7ff;
        font-family: ${UI_FONT_FAMILY};
        font-size: 12px;
        line-height: 1;
        box-sizing: border-box;
      }

      #command-prefix {
        color: ${UI_MAIN_COLOR};
        font-size: 17px;
        line-height: 1;
        display: inline-flex;
        align-items: center;
        transform: translateY(-1px);
      }

      #command-text {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        line-height: 1;
      }
    </style>
  </head>
  <body>
    <fieldset id="command-shell">
      <legend id="command-title">Cmdline</legend>
      <div id="command-overlay">
        <span id="command-prefix"></span>
        <span id="command-text"></span>
      </div>
    </fieldset>
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

      ${UI_FONT_FACE_CSS}

      #whichkey-overlay {
        width: 100%;
        height: 100%;
        margin: 0;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 2px 14px 8px;
        border-radius: 8px;
        border: 1px solid ${UI_MAIN_COLOR};
        background: ${UI_PANEL_BG_COLOR};
        color: #f2f6ff;
        box-sizing: border-box;
        font-family: ${UI_FONT_FAMILY};
      }

      #whichkey-title {
        margin: 0 auto;
        padding: 0 8px;
        color: ${UI_MUTED_TEXT_COLOR};
        font-size: 11px;
        line-height: 1;
      }

      #whichkey-prefix {
        color: ${UI_MUTED_TEXT_COLOR};
        font-size: 11px;
        min-height: 14px;
      }

      #whichkey-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0 14px;
        flex: 1;
        min-height: 0;
      }

      .whichkey-column {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }

      .whichkey-entry {
        display: grid;
        grid-template-columns: max-content max-content minmax(0, 1fr);
        align-items: center;
        column-gap: 4px;
        min-width: 0;
        font-size: 12px;
      }

      .whichkey-key {
        color: ${UI_MAIN_COLOR};
        white-space: nowrap;
      }

      .whichkey-arrow {
        color: ${UI_MUTED_TEXT_COLOR};
      }

      .whichkey-label {
        color: #b6c7e8;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      #whichkey-hints {
        display: flex;
        justify-content: center;
        gap: 18px;
        color: ${UI_MUTED_TEXT_COLOR};
        font-size: 12px;
      }

      .whichkey-hint {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .whichkey-hint-icon {
        color: ${UI_MAIN_COLOR};
        display: inline-flex;
        align-items: center;
        font-size: 18px;
        line-height: 1;
      }

      .whichkey-hint-label {
        display: inline-flex;
        align-items: center;
        color: ${UI_MUTED_TEXT_COLOR};
        font-size: 12px;
        line-height: 1;
      }
    </style>
  </head>
  <body>
    <fieldset id="whichkey-overlay">
      <legend id="whichkey-title">whichkey</legend>
      <div id="whichkey-prefix"></div>
      <div id="whichkey-grid"></div>
      <div id="whichkey-hints">
        <span class="whichkey-hint"><span class="whichkey-hint-icon">󱊷</span><span class="whichkey-hint-label">close</span></span>
        <span class="whichkey-hint"><span class="whichkey-hint-icon">󰁮</span><span class="whichkey-hint-label">back</span></span>
      </div>
    </fieldset>
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

      ${UI_FONT_FACE_CSS}

      #statusline {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0;
        box-sizing: border-box;
        background: #151a22;
        border-top: 1px solid #2a3140;
        color: #d8e3f8;
        font-family: ${UI_FONT_FAMILY};
        font-size: 12px;
        line-height: 1;
      }

      #statusline-mode {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 100%;
        padding: 0 12px;
        border-radius: 0;
        background: ${UI_ACCENT_PILL_BG};
      }

      #statusline-mode-icon {
        color: ${UI_MAIN_COLOR};
        font-size: 16px;
        line-height: 1;
      }

      #statusline-mode-label {
        color: ${UI_MAIN_COLOR};
        text-transform: uppercase;
        letter-spacing: 0.06em;
        line-height: 1;
      }

      #statusline-right {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        padding-right: 12px;
      }

      #statusline-split {
        display: none;
        align-items: center;
        gap: 0;
        line-height: 1;
      }

      #statusline-split-sep {
        color: #7d8aa3;
      }

      #statusline-scroll {
        color: #d8e3f8;
        display: inline-flex;
        align-items: center;
        line-height: 1;
      }
    </style>
  </head>
  <body>
    <div id="statusline">
      <span id="statusline-mode"><span id="statusline-mode-icon"></span><span id="statusline-mode-label">NORMAL</span></span>
      <span id="statusline-right"><span id="statusline-split" aria-label="Split focus"><span id="statusline-split-left">L</span><span id="statusline-split-sep">/</span><span id="statusline-split-right">R</span></span><span id="statusline-scroll">0%</span></span>
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
    this.statuslineSplitIndicator = {
      visible: false,
      focusedPane: "left",
    };
    this.pendingTablineSnapshot = [];
    this.tablineRenderTimer = null;
    this.tablineActions = {};
    this.windowChrome = {
      platform: process.platform,
      useNativeControls: process.platform === "darwin",
      isMaximized: false,
      isFullScreen: false,
    };
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

    this.window.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(SHELL_HTML)}`,
    );

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
      this.updateStatuslineSplitIndicator(this.statuslineSplitIndicator);
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
      renderTabline(
        this.window.webContents,
        this.pendingTablineSnapshot,
        this.windowChrome,
        this.tablineActions,
      );
    }, 16);
  }

  setTablineActions(actions = {}) {
    this.tablineActions = {
      ...actions,
    };
    this.renderTabline(this.pendingTablineSnapshot);
  }

  setWindowChrome(chrome = {}) {
    this.windowChrome = {
      ...this.windowChrome,
      ...chrome,
    };
    this.renderTabline(this.pendingTablineSnapshot);
  }

  getContentTopInset() {
    return UI_SHELL_TABLINE_HEIGHT;
  }

  relayout() {
    if (
      !this.window ||
      !this.commandOverlayView ||
      !this.whichKeyOverlayView ||
      !this.statuslineView
    )
      return;

    const bounds = this.window.getContentBounds();
    const width = this.commandVisible
      ? Math.min(500, Math.max(bounds.width - 160, 300))
      : 1;
    const height = this.commandVisible ? 42 : 1;
    const x = this.commandVisible
      ? Math.max(Math.floor((bounds.width - width) / 2), 0)
      : -10000;
    const y = this.commandVisible
      ? Math.max(
          Math.floor((bounds.height - height) / 2),
          UI_SHELL_TABLINE_HEIGHT + 10,
        )
      : -10000;

    this.commandOverlayView.setBounds({ x, y, width, height });

    const whichWidth = this.whichKeyVisible
      ? Math.min(980, Math.max(bounds.width - 28, 560))
      : 1;
    const whichHeight = this.whichKeyVisible ? 150 : 1;
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
      y: Math.max(
        bounds.height - UI_SHELL_STATUSLINE_HEIGHT,
        UI_SHELL_TABLINE_HEIGHT + 1,
      ),
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
    if (!this.window || typeof this.window.setTopBrowserView !== "function")
      return;

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

  updateWhichKey(
    model,
    timeoutMs = 1200,
    delayMs = 0,
    ensureVisible = true,
    forceImmediate = false,
  ) {
    if (ensureVisible) {
      if (!this.whichKeyVisible && !forceImmediate && delayMs && delayMs > 0) {
        this.whichKeyModel = model ||
          this.whichKeyModel || { prefix: "<leader>", entries: [] };
        this.whichKeyPendingTimeoutMs = timeoutMs;
        this.clearWhichKeyHideTimer();
        this.resetWhichKeyShowTimer(delayMs);
        return;
      }

      this.whichKeyVisible = true;
      this.clearWhichKeyShowTimer();
    }

    this.whichKeyModel = model ||
      this.whichKeyModel || { prefix: "<leader>", entries: [] };

    if (timeoutMs === null) {
      this.clearWhichKeyHideTimer();
    } else {
      this.resetWhichKeyHideTimer(timeoutMs);
    }

    this.syncOverlayStack();

    if (!this.whichKeyOverlayView || !this.whichKeyOverlayReady) return;

    const safeModel = {
      prefix: this.whichKeyModel.prefix || "<leader>",
      entries: Array.isArray(this.whichKeyModel.entries)
        ? this.whichKeyModel.entries
        : [],
    };

    this.whichKeyOverlayView.webContents.executeJavaScript(`
      (function updateWhichKeyOverlay() {
        const prefixNode = document.getElementById('whichkey-prefix');
        const gridNode = document.getElementById('whichkey-grid');
        if (!prefixNode || !gridNode) return;

        const model = ${JSON.stringify(safeModel)};
        prefixNode.textContent = model.prefix || '<leader>';

        const escapeHtml = (value) => String(value)
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#39;');

        const entries = (Array.isArray(model.entries) ? model.entries : []).filter((entry) => {
          const key = String(entry && entry.key ? entry.key : '').toLowerCase();
          return key !== 'backspace';
        });

        const columnCount = 3;
        const maxRowsPerColumn = 6;
        const columns = Array.from({ length: columnCount }, (_, index) =>
          entries.slice(index * maxRowsPerColumn, (index + 1) * maxRowsPerColumn),
        );

        gridNode.innerHTML = columns
          .map((columnEntries) => {
            const rows = columnEntries
              .map((entry) => {
                const key = escapeHtml(String(entry.key || ''));
                const label = escapeHtml(String(entry.label || ''));
                return '<div class="whichkey-entry"><span class="whichkey-key">' + key + '</span><span class="whichkey-arrow">-&gt;</span><span class="whichkey-label">' + label + '</span></div>';
              })
              .join('');

            return '<div class="whichkey-column">' + rows + '</div>';
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
      this.updateWhichKey(
        this.whichKeyModel,
        this.whichKeyPendingTimeoutMs,
        0,
        true,
        true,
      );
      return;
    }

    this.whichKeyShowTimer = setTimeout(() => {
      this.whichKeyShowTimer = null;
      this.whichKeyVisible = true;
      this.updateWhichKey(
        this.whichKeyModel,
        this.whichKeyPendingTimeoutMs,
        0,
        true,
        true,
      );
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
        const node = document.getElementById('statusline-mode-label');
        if (!node) return;
        node.textContent = ${JSON.stringify(this.statuslineMode)};
      })();
    `);
  }

  updateStatuslineScroll(percent) {
    const normalized = Number.isFinite(percent)
      ? Math.max(0, Math.min(100, percent))
      : 0;
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

  updateStatuslineSplitIndicator(splitStatus = {}) {
    const enabledRegularSplit = Boolean(
      splitStatus.enabled && splitStatus.mode === "regular",
    );
    const focusedPane = splitStatus.focusedPane === "right" ? "right" : "left";

    this.statuslineSplitIndicator = {
      visible: enabledRegularSplit,
      focusedPane,
    };

    if (!this.statuslineView || !this.statuslineReady) return;

    this.statuslineView.webContents.executeJavaScript(`
      (function updateStatuslineSplitIndicator() {
        const root = document.getElementById('statusline-split');
        const left = document.getElementById('statusline-split-left');
        const right = document.getElementById('statusline-split-right');
        if (!root || !left || !right) return;

        const visible = ${JSON.stringify(this.statuslineSplitIndicator.visible)};
        const focusedPane = ${JSON.stringify(this.statuslineSplitIndicator.focusedPane)};
        const focusedColor = ${JSON.stringify(UI_MAIN_COLOR)};
        const mutedColor = ${JSON.stringify(UI_MUTED_TEXT_COLOR)};

        root.style.display = visible ? 'inline-flex' : 'none';

        if (!visible) {
          left.style.color = mutedColor;
          right.style.color = mutedColor;
          return;
        }

        left.style.color = focusedPane === 'left' ? focusedColor : mutedColor;
        right.style.color = focusedPane === 'right' ? focusedColor : mutedColor;
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

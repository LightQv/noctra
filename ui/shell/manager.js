const { BrowserView } = require("electron");
const { renderTabline } = require("../tabline");
const {
  UI_SHELL_TABLINE_HEIGHT,
  UI_SHELL_STATUSLINE_HEIGHT,
  UI_FONT_FAMILY,
  UI_FONT_FACE_CSS,
} = require("../constants");
const { DEFAULT_THEME, toCssVars } = require("../theme");

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
        background: var(--ui-bg-app, #0f131a);
        overflow: hidden;
      }

      #split-divider {
        position: fixed;
        top: ${UI_SHELL_TABLINE_HEIGHT}px;
        bottom: ${UI_SHELL_STATUSLINE_HEIGHT}px;
        width: 1px;
        left: 0;
        display: none;
        pointer-events: none;
        background: var(--ui-split-divider, #283140);
        z-index: 1;
      }

      :root {
        --ui-font-family: ${UI_FONT_FAMILY};
      }
    </style>
  </head>
  <body>
    <div id="split-divider" aria-hidden="true"></div>
  </body>
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
        padding: 0 10px;
        border-radius: 6px;
        border: 1px solid var(--ui-accent, #89dceb);
        background: var(--ui-bg-panel, #161b24);
        box-sizing: border-box;
        display: flex;
        align-items: center;
      }

      #command-title {
        margin: 0 auto;
        padding: 0 8px;
        color: var(--ui-accent, #89dceb);
        background: var(--ui-bg-panel, #161b24);
        font-family: var(--ui-font-family, ${UI_FONT_FAMILY});
        font-size: 13px;
        line-height: 1;
      }

      #command-overlay {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0;
        transform: translateY(-1px);
        color: var(--ui-text-bright, #f4f7ff);
        font-family: var(--ui-font-family, ${UI_FONT_FAMILY});
        font-size: 13px;
        line-height: 1;
        box-sizing: border-box;
      }

      #command-prefix {
        color: var(--ui-accent, #89dceb);
        font-size: 17px;
        line-height: 1;
        display: flex;
        align-items: center;
        height: 100%;
      }

      #command-content {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 1px;
        height: 100%;
        overflow: hidden;
        white-space: pre;
      }

      .command-text-segment {
        min-width: 0;
        overflow: hidden;
        white-space: pre;
        line-height: 1;
      }

      #command-cursor {
        height: 1.22em;
        background: var(--ui-accent, #89dceb);
        border-radius: 1px;
        flex: 0 0 auto;
        transform: translateY(-1px);
      }

      #command-cursor.cursor-block {
        width: 0.54em;
      }

      #command-cursor.cursor-bar {
        width: 1px;
      }
    </style>
  </head>
  <body>
    <fieldset id="command-shell">
      <legend id="command-title">Cmdline</legend>
      <div id="command-overlay">
        <span id="command-prefix"></span>
        <span id="command-content"><span id="command-text-before" class="command-text-segment"></span><span id="command-cursor" class="cursor-block" aria-hidden="true"></span><span id="command-text-after" class="command-text-segment"></span></span>
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

      :root {
        --ui-font-family: ${UI_FONT_FAMILY};
      }

      #whichkey-overlay {
        width: 100%;
        height: 100%;
        margin: 0;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 2px 14px 8px;
        border-radius: 6px;
        border: 1px solid var(--ui-accent, #89dceb);
        background: var(--ui-bg-panel, #161b24);
        color: var(--ui-text-bright, #f2f6ff);
        box-sizing: border-box;
        font-family: var(--ui-font-family, ${UI_FONT_FAMILY});
      }

      #whichkey-title {
        margin: 0 auto;
        padding: 0 8px;
        color: var(--ui-text-muted, #7d8aa3);
        background: var(--ui-bg-panel, #161b24);
        font-size: 13px;
        line-height: 1;
      }

      #whichkey-prefix {
        color: var(--ui-text-muted, #7d8aa3);
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
        color: var(--ui-accent, #89dceb);
        white-space: nowrap;
      }

      .whichkey-arrow {
        color: var(--ui-text-muted, #7d8aa3);
      }

      .whichkey-label {
        color: var(--ui-text-soft, #b6c7e8);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      #whichkey-hints {
        display: flex;
        justify-content: center;
        gap: 18px;
        color: var(--ui-text-muted, #7d8aa3);
        font-size: 12px;
      }

      .whichkey-hint {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .whichkey-hint-icon {
        color: var(--ui-accent, #89dceb);
        display: inline-flex;
        align-items: center;
        font-size: 18px;
        line-height: 1;
      }

      .whichkey-hint-label {
        display: inline-flex;
        align-items: center;
        color: var(--ui-text-muted, #7d8aa3);
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

      :root {
        --ui-font-family: ${UI_FONT_FAMILY};
      }

      #statusline {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0;
        box-sizing: border-box;
        background: var(--ui-bg-statusline, #151a22);
        border-top: 1px solid var(--ui-border-strong, #2a3140);
        color: var(--ui-text, #d8e3f8);
        font-family: var(--ui-font-family, ${UI_FONT_FAMILY});
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
        background: var(--ui-accent-pill-bg, #263846);
      }

      #statusline-mode-icon {
        color: var(--ui-accent, #89dceb);
        font-size: 16px;
        line-height: 1;
      }

      #statusline-mode-label {
        color: var(--ui-accent, #89dceb);
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
        color: var(--ui-text-muted, #7d8aa3);
      }

      #statusline-scroll {
        color: var(--ui-text, #d8e3f8);
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
    this.commandCursorIndex = 0;
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
    this.splitDividerState = {
      visible: false,
      offsetPx: 0,
    };
    this.tablineActions = {};
    this.windowChrome = {
      platform: process.platform,
      useNativeControls: process.platform === "darwin",
      isMaximized: false,
      isFullScreen: false,
    };
    this.currentTheme = {
      ...DEFAULT_THEME,
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
      this.applyThemeToWebContents(this.window.webContents);
      this.renderTabline(this.pendingTablineSnapshot);
      this.updateSplitDivider(this.splitDividerState);
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
      this.applyThemeToWebContents(this.commandOverlayView.webContents);
      this.updateCommand(this.commandText, this.commandCursorIndex);
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
      this.applyThemeToWebContents(this.whichKeyOverlayView.webContents);
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
      this.applyThemeToWebContents(this.statuslineView.webContents);
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
        this.currentTheme,
      );
    }, 16);
  }

  setTheme(nextTheme = {}) {
    this.currentTheme = {
      ...DEFAULT_THEME,
      ...(nextTheme && typeof nextTheme === "object" ? nextTheme : {}),
    };

    this.applyThemeToWebContents(this.window && this.window.webContents);
    this.applyThemeToWebContents(this.commandOverlayView && this.commandOverlayView.webContents);
    this.applyThemeToWebContents(this.whichKeyOverlayView && this.whichKeyOverlayView.webContents);
    this.applyThemeToWebContents(this.statuslineView && this.statuslineView.webContents);
    this.renderTabline(this.pendingTablineSnapshot);
    this.updateStatuslineSplitIndicator(this.statuslineSplitIndicator);
    this.updateSplitDivider(this.splitDividerState);
  }

  updateSplitDivider(splitStatus = {}) {
    const divider = splitStatus.divider && typeof splitStatus.divider === "object"
      ? splitStatus.divider
      : {};
    const visible = Boolean(divider.visible);
    const offsetPx = Number.isFinite(divider.offsetPx) ? Math.max(0, Math.floor(divider.offsetPx)) : 0;

    this.splitDividerState = {
      visible,
      offsetPx,
    };

    if (!this.window || !this.shellHostReady) return;

    this.window.webContents.executeJavaScript(`
      (function updateSplitDivider() {
        const divider = document.getElementById('split-divider');
        if (!divider) return;
        const visible = ${JSON.stringify(visible)};
        const offsetPx = ${JSON.stringify(offsetPx)};
        divider.style.display = visible ? 'block' : 'none';
        divider.style.left = visible ? offsetPx + 'px' : '0px';
      })();
    `).catch(() => {});
  }

  applyThemeToWebContents(webContents) {
    if (!webContents || webContents.isDestroyed()) return;

    const cssVars = {
      ...toCssVars(this.currentTheme),
      "--ui-font-family": this.currentTheme.fontFamily,
    };

    webContents
      .executeJavaScript(`
      (function applyNoctraThemeVars() {
        const vars = ${JSON.stringify(cssVars)};
        const style = document.documentElement && document.documentElement.style;
        if (!style) return;

        for (const [name, value] of Object.entries(vars)) {
          if (typeof name !== 'string' || typeof value !== 'string') continue;
          style.setProperty(name, value);
        }
      })();
    `)
      .catch(() => {});
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

  showCommand(text = "", cursorIndex = null) {
    this.commandVisible = true;
    this.commandText = text;
    this.commandCursorIndex = Number.isFinite(cursorIndex)
      ? Math.max(0, Math.min(Math.trunc(cursorIndex), String(text).length))
      : String(text).length;
    this.keepCommandOverlayAboveContentViews();
    this.updateCommand(text, this.commandCursorIndex);
  }

  hideCommand() {
    this.commandVisible = false;
    this.commandText = "";
    this.commandCursorIndex = 0;
    this.updateCommand("", 0);
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
        const focusedColor = ${JSON.stringify(this.currentTheme.mainColor)};
        const mutedColor = ${JSON.stringify(this.currentTheme.mutedTextColor)};

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

  updateCommand(text = "", cursorIndex = null) {
    const nextText = String(text);
    const maxCursor = nextText.length;
    const nextCursor = Number.isFinite(cursorIndex)
      ? Math.max(0, Math.min(Math.trunc(cursorIndex), maxCursor))
      : maxCursor;

    this.commandText = nextText;
    this.commandCursorIndex = nextCursor;

    if (!this.commandOverlayView || !this.commandOverlayReady) return;

    const beforeText = nextText.slice(0, nextCursor);
    const afterText = nextText.slice(nextCursor);
    const cursorClass = nextCursor < nextText.length ? "cursor-bar" : "cursor-block";

    this.commandOverlayView.webContents.executeJavaScript(`
      (function updateCommandOverlayText() {
        const beforeNode = document.getElementById('command-text-before');
        const afterNode = document.getElementById('command-text-after');
        const cursorNode = document.getElementById('command-cursor');
        if (!beforeNode || !afterNode || !cursorNode) return;
        beforeNode.textContent = ${JSON.stringify(beforeText)};
        afterNode.textContent = ${JSON.stringify(afterText)};
        cursorNode.className = ${JSON.stringify(cursorClass)};
      })();
    `);
  }
}

module.exports = new UiShellManager();

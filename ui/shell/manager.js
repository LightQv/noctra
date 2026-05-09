const { renderTabline } = require("../tabline");
const { renderUrlline: renderShellUrlline } = require("../urlline");
const {
  createOverlayBrowserView,
  attachOverlayBrowserView,
} = require("../../core/adapters/platform/overlayViewHost");
const {
  applyOverlayLayout,
  applyOverlayStack,
} = require("../../core/adapters/platform/overlayLayoutHost");
const { pushShellPatch } = require("../../core/adapters/renderer/shellPatchTransport");
const {
  UI_SHELL_TABLINE_HEIGHT,
  UI_SHELL_STATUSLINE_HEIGHT,
  UI_FONT_FAMILY,
  UI_FONT_FACE_CSS,
  UI_TREE_LAYOUT,
} = require("../constants");
const { DEFAULT_THEME, toCssVars } = require("../theme");

const INTERNAL_UI_CSP =
  "default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; worker-src 'none'; media-src 'none'; manifest-src 'none'; frame-ancestors 'none'";

const SHELL_HTML = `
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${INTERNAL_UI_CSP}" />
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
    <meta http-equiv="Content-Security-Policy" content="${INTERNAL_UI_CSP}" />
    <style>
      html,
      body {
        margin: 0;
        width: 100%;
        height: 100%;
        background: transparent;
        overflow: visible;
        pointer-events: none;
      }

      ${UI_FONT_FACE_CSS}

      #command-shell {
        position: relative;
        width: 100%;
        height: calc(100% - 4px);
        margin: 4px 0 0;
        min-width: 0;
        padding: 8px 8px;
        border-radius: 6px;
        border: 1px solid var(--ui-accent, #89dceb);
        background: var(--ui-bg-panel, #161b24);
        box-sizing: border-box;
        display: flex;
        align-items: center;
      }

      #command-title {
        position: absolute;
        top: 0;
        left: 50%;
        transform: translate(-50%, -50%);
        padding: 0 8px;
        color: var(--ui-accent, #89dceb);
        background: var(--ui-bg-panel, #161b24);
        font-family: var(--ui-font-family, ${UI_FONT_FAMILY});
        font-size: 13px;
        line-height: 14px;
        white-space: nowrap;
      }

      #command-overlay {
        position: relative;
        width: 100%;
        height: 20px;
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 0;
        color: var(--ui-text-bright, #f4f7ff);
        font-family: var(--ui-font-family, ${UI_FONT_FAMILY});
        font-size: 13px;
        line-height: 20px;
        box-sizing: border-box;
      }

      #command-prefix {
        color: var(--ui-accent, #89dceb);
        font-size: 20px;
        line-height: 20px;
        font-family: var(--ui-font-family, ${UI_FONT_FAMILY});
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 18px;
        height: 20px;
        transform: translateY(0.25px);
      }

      #command-content {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 1px;
        height: 20px;
        overflow: hidden;
        white-space: pre;
      }

      .command-text-segment {
        min-width: 0;
        overflow: hidden;
        white-space: pre;
        line-height: 20px;
      }

      #command-cursor {
        height: 18px;
        background: var(--ui-accent, #89dceb);
        border-radius: 1px;
        flex: 0 0 auto;
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
    <div id="command-shell">
      <div id="command-title">Cmdline</div>
      <div id="command-overlay">
        <span id="command-prefix"></span>
        <span id="command-content"><span id="command-text-before" class="command-text-segment"></span><span id="command-cursor" class="cursor-block" aria-hidden="true"></span><span id="command-text-after" class="command-text-segment"></span></span>
      </div>
    </div>
  </body>
</html>
`;

const WHICHKEY_OVERLAY_HTML = `
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${INTERNAL_UI_CSP}" />
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
        grid-template-columns: repeat(4, minmax(0, 1fr));
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

const SELECTION_MODAL_OVERLAY_HTML = `
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${INTERNAL_UI_CSP}" />
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

      #selection-modal {
        margin: 0;
        min-width: 0;
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        border-radius: 6px;
        border: 1px solid var(--ui-accent, #89dceb);
        background: var(--ui-bg-panel, #161b24);
        color: var(--ui-text-bright, #f4f7ff);
        display: flex;
        flex-direction: column;
        padding: 6px 8px 8px;
        gap: 6px;
        font-family: var(--ui-font-family, ${UI_FONT_FAMILY});
      }

      #selection-modal-title {
        align-self: center;
        margin: 0 auto;
        padding: 0 8px;
        color: var(--ui-text-muted, #7d8aa3);
        background: var(--ui-bg-panel, #161b24);
        font-size: 12px;
        line-height: 1;
      }

      #selection-modal-prompt {
        color: var(--ui-text-soft, #b6c7e8);
        font-size: 12px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      #selection-modal-url {
        color: var(--ui-text-muted, #7d8aa3);
        font-size: 11px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      #selection-modal-scope {
        color: var(--ui-accent, #89dceb);
        font-size: 11px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      #selection-modal-content {
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .selection-modal-grid {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: minmax(0, 1fr);
        column-gap: 12px;
        align-items: end;
      }

      .selection-modal-col {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        min-width: 0;
        gap: 2px;
      }

      .selection-modal-item {
        color: var(--ui-text-soft, #b6c7e8);
        font-size: 12px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 150px;
        text-align: center;
        border-radius: 4px;
        padding: 2px 6px;
      }

      .selection-modal-item.selected {
        background: color-mix(in srgb, var(--ui-bg-subtle, #1f2735) 55%, transparent);
        color: var(--ui-text-bright, #f4f7ff);
      }

      .selection-modal-index {
        color: var(--ui-accent, #89dceb);
        font-size: 11px;
        white-space: nowrap;
        max-width: 150px;
        text-align: center;
      }

      .selection-modal-empty {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--ui-text-muted, #7d8aa3);
        font-size: 12px;
      }

      #selection-modal-footer {
        display: flex;
        justify-content: space-between;
        color: var(--ui-text-muted, #7d8aa3);
        font-size: 11px;
      }
    </style>
  </head>
  <body>
    <fieldset id="selection-modal">
      <legend id="selection-modal-title">Bookmark</legend>
      <div id="selection-modal-prompt"></div>
      <div id="selection-modal-url"></div>
      <div id="selection-modal-scope"></div>
      <div id="selection-modal-content"></div>
      <div id="selection-modal-footer"></div>
    </fieldset>
  </body>
</html>
`;

const TELESCOPE_OVERLAY_HTML = `
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${INTERNAL_UI_CSP}" />
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

      #telescope-shell {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        gap: 4px;
        box-sizing: border-box;
        font-family: var(--ui-font-family, ${UI_FONT_FAMILY});
      }

      #telescope-prompt {
        position: relative;
        margin: 4px 0 0;
        height: 38px;
        min-inline-size: 0;
        border: 1px solid var(--ui-accent, #89dceb);
        border-radius: 6px;
        background: var(--ui-bg-panel, #161b24);
        padding: 8px;
        display: flex;
        align-items: center;
        box-sizing: border-box;
      }

      #telescope-results {
        margin: 0;
        min-inline-size: 0;
        flex: 1;
        min-height: 0;
        border: 1px solid var(--ui-accent, #89dceb);
        border-radius: 6px;
        background: var(--ui-bg-panel, #161b24);
        padding: 0 0 6px 0;
        box-sizing: border-box;
      }

      #telescope-results-title,
      #telescope-prompt-title {
        margin: 0 auto;
        padding: 0 8px;
        color: var(--ui-text-muted, #7d8aa3);
        background: var(--ui-bg-panel, #161b24);
        font-size: 12px;
      }

      #telescope-prompt-title {
        position: absolute;
        top: 0;
        left: 50%;
        transform: translate(-50%, -50%);
        line-height: 14px;
        white-space: nowrap;
      }

      #telescope-list {
        height: 100%;
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        display: flex;
        flex-direction: column;
        gap: 0;
        padding: 0;
        margin: 0;
      }

      .telescope-empty {
        color: var(--ui-text-muted, #7d8aa3);
        font-size: 12px;
        padding: 4px 6px;
      }

      .telescope-row {
        display: flex;
        align-items: stretch;
        gap: 0;
        min-height: ${UI_TREE_LAYOUT.rowMinHeight}px;
        line-height: ${UI_TREE_LAYOUT.rowLineHeight}px;
        padding: 0;
        border-radius: 0;
        color: var(--ui-text-soft, #b6c7e8);
        font-size: 12px;
      }

      .telescope-row.selected {
        background: color-mix(in srgb, var(--ui-bg-subtle, #1f2735) 58%, transparent);
        color: var(--ui-text-bright, #f4f7ff);
      }

      .telescope-cursor {
        width: ${UI_TREE_LAYOUT.cursorWidth}px;
        align-self: stretch;
        border-radius: 1px;
        background: transparent;
        flex: 0 0 ${UI_TREE_LAYOUT.cursorWidth}px;
      }

      .telescope-row.selected .telescope-cursor {
        background: var(--ui-editor-cursor, #89dceb);
      }

      .telescope-primary {
        min-width: 0;
        flex: 1;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        padding: 0 ${UI_TREE_LAYOUT.namePaddingRight}px 0 ${UI_TREE_LAYOUT.namePaddingLeft}px;
        display: flex;
        align-items: center;
      }

      .telescope-right {
        color: var(--ui-text-muted, #7d8aa3);
        white-space: nowrap;
        text-align: right;
        width: ${UI_TREE_LAYOUT.rightColWidth}px;
        flex: 0 0 ${UI_TREE_LAYOUT.rightColWidth}px;
        padding: 0 ${UI_TREE_LAYOUT.namePaddingRight}px 0 0;
        display: flex;
        align-items: center;
        justify-content: flex-end;
      }

      #telescope-prompt-content {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 13px;
        min-height: 20px;
        height: 20px;
        line-height: 20px;
        width: 100%;
      }

      #telescope-prefix {
        color: var(--ui-accent, #89dceb);
        font-size: 20px;
        line-height: 20px;
        min-width: 18px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 20px;
        transform: translateY(0.25px);
      }

      #telescope-query {
        min-width: 0;
        flex: 1;
        color: var(--ui-text-bright, #f4f7ff);
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      #telescope-counter {
        color: var(--ui-accent, #89dceb);
        white-space: nowrap;
      }
    </style>
  </head>
  <body>
    <div id="telescope-shell">
      <div id="telescope-prompt">
        <div id="telescope-prompt-title">Find</div>
        <div id="telescope-prompt-content">
          <span id="telescope-prefix"></span>
          <span id="telescope-query"></span>
          <span id="telescope-counter">0 / 0</span>
        </div>
      </div>
      <fieldset id="telescope-results">
        <legend id="telescope-results-title">Results</legend>
        <div id="telescope-list"></div>
      </fieldset>
    </div>
  </body>
</html>
`;

const STATUSLINE_OVERLAY_HTML = `
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${INTERNAL_UI_CSP}" />
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
        background: var(--ui-bg-shell, #151a22);
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

const TOAST_OVERLAY_HTML = `
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${INTERNAL_UI_CSP}" />
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

      #toast-root {
        position: fixed;
        top: 0;
        right: 0;
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 8px;
        padding: 8px 16px 0 0;
        box-sizing: border-box;
      }

      .toast-item {
        width: min(420px, 100%);
        max-width: 100%;
        box-sizing: border-box;
        border: 1px solid var(--ui-border, #2f3440);
        background: var(--ui-bg-panel, #161b24);
        color: var(--ui-text, #d8e3f8);
        border-left-width: 4px;
        border-radius: 6px;
        padding: 10px 10px;
        font-family: var(--ui-font-family, ${UI_FONT_FAMILY});
        font-size: 12px;
        line-height: 1.4;
        box-shadow: 0 8px 22px rgba(0, 0, 0, 0.35);
        opacity: 0;
        transform: translateY(-6px);
        transition: opacity 120ms ease, transform 120ms ease;
      }

      .toast-item.show {
        opacity: 1;
        transform: translateY(0);
      }

    </style>
  </head>
  <body>
    <div id="toast-root" aria-live="polite" aria-atomic="false"></div>
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
    this.commandContext = "shell";
    this.whichKeyOverlayView = null;
    this.whichKeyOverlayReady = false;
    this.whichKeyVisible = false;
    this.whichKeyModel = { prefix: "<leader>", entries: [] };
    this.whichKeyHideTimer = null;
    this.whichKeyShowTimer = null;
    this.whichKeyPendingTimeoutMs = 1200;
    this.selectionModalView = null;
    this.selectionModalReady = false;
    this.selectionModalVisible = false;
    this.selectionModalModel = null;
    this.telescopeView = null;
    this.telescopeReady = false;
    this.telescopeVisible = false;
    this.telescopeModel = null;
    this.statuslineView = null;
    this.statuslineReady = false;
    this.toastOverlayView = null;
    this.toastOverlayReady = false;
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
    this.tablineOptions = {
      showFavicon: false,
      dimActiveBuffer: false,
    };
    this.urllineActions = {};
    this.urllineModel = { panes: [] };
    this.windowChrome = {
      platform: process.platform,
      useNativeControls: process.platform === "darwin",
      isMaximized: false,
      isFullScreen: false,
    };
    this.currentTheme = {
      ...DEFAULT_THEME,
    };
    this.pendingToasts = [];
  }

  showNotificationToast(toast = {}) {
    if (!this.window || !this.toastOverlayView || !this.toastOverlayReady) {
      this.pendingToasts.push(toast);
      if (this.pendingToasts.length > 50) {
        this.pendingToasts.shift();
      }
      return;
    }

    const severity =
      toast.severity === "error" || toast.severity === "warning"
        ? toast.severity
        : "info";
    const message = String(toast.message || "");
    const timeoutMs = Number.isFinite(toast.timeoutMs)
      ? Math.max(800, Math.floor(toast.timeoutMs))
      : 2200;
    const accentColor =
      severity === "error"
        ? this.currentTheme.dangerTextColor
        : severity === "warning"
          ? "#f6c177"
          : this.currentTheme.mainColor;

    pushShellPatch(
      this.toastOverlayView.webContents,
      `
      (function pushToast() {
        const root = document.getElementById('toast-root');
        if (!root) return;
        const node = document.createElement('div');
        node.className = 'toast-item';
        node.style.borderLeftColor = ${JSON.stringify(accentColor)};
        node.textContent = ${JSON.stringify(message)};
        root.prepend(node);
        requestAnimationFrame(() => node.classList.add('show'));
        setTimeout(() => {
          node.classList.remove('show');
          setTimeout(() => {
            if (node.parentElement) {
              node.parentElement.removeChild(node);
            }
          }, 140);
        }, ${JSON.stringify(timeoutMs)});
      })();
    `,
      {
        onError(error) {
        console.warn(
          "[noctra:warning] toast_render_failed",
          error && error.message ? error.message : error,
        );
        },
      },
    );
  }

  flushPendingToasts() {
    if (
      !this.window ||
      !this.shellHostReady ||
      this.pendingToasts.length === 0
    ) {
      return;
    }

    const queuedToasts = this.pendingToasts.splice(
      0,
      this.pendingToasts.length,
    );
    for (const toast of queuedToasts) {
      this.showNotificationToast(toast);
    }
  }

  init(windowRef) {
    this.window = windowRef;
    this.shellHostReady = false;
    this.pendingTablineSnapshot = [];

    this.initializeShellHost();
    this.initializeCommandOverlayView();
    this.initializeWhichKeyOverlayView();
    this.initializeSelectionModalView();
    this.initializeTelescopeView();
    this.initializeStatuslineView();
    this.initializeToastOverlayView();

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
      this.renderUrlline(this.urllineModel);
      this.updateSplitDivider(this.splitDividerState);
      this.flushPendingToasts();
    });
  }

  initializeCommandOverlayView() {
    if (!this.window) return;

    this.commandOverlayView = createOverlayBrowserView(COMMAND_OVERLAY_HTML);

    this.commandOverlayView.setAutoResize({ width: false, height: false });

    this.commandOverlayView.webContents.on("did-finish-load", () => {
      this.commandOverlayReady = true;
      this.applyThemeToWebContents(this.commandOverlayView.webContents);
      this.updateCommand(this.commandText, this.commandCursorIndex);
    });

    attachOverlayBrowserView(this.window, this.commandOverlayView);
    this.relayout();
  }

  initializeWhichKeyOverlayView() {
    if (!this.window) return;

    this.whichKeyOverlayView = createOverlayBrowserView(WHICHKEY_OVERLAY_HTML);

    this.whichKeyOverlayView.setAutoResize({ width: false, height: false });

    this.whichKeyOverlayView.webContents.on("did-finish-load", () => {
      this.whichKeyOverlayReady = true;
      this.applyThemeToWebContents(this.whichKeyOverlayView.webContents);
      this.updateWhichKey(this.whichKeyModel, null, 0, false, true);
    });

    attachOverlayBrowserView(this.window, this.whichKeyOverlayView);
    this.relayout();
  }

  initializeSelectionModalView() {
    if (!this.window) return;

    this.selectionModalView = createOverlayBrowserView(SELECTION_MODAL_OVERLAY_HTML);

    this.selectionModalView.setAutoResize({ width: false, height: false });

    this.selectionModalView.webContents.on("did-finish-load", () => {
      this.selectionModalReady = true;
      this.applyThemeToWebContents(this.selectionModalView.webContents);
      if (this.selectionModalModel) {
        this.updateSelectionModal(this.selectionModalModel);
      }
    });

    attachOverlayBrowserView(this.window, this.selectionModalView);
    this.relayout();
  }

  initializeTelescopeView() {
    if (!this.window) return;

    this.telescopeView = createOverlayBrowserView(TELESCOPE_OVERLAY_HTML);

    this.telescopeView.setAutoResize({ width: false, height: false });

    this.telescopeView.webContents.on("did-finish-load", () => {
      this.telescopeReady = true;
      this.applyThemeToWebContents(this.telescopeView.webContents);
      if (this.telescopeModel) {
        this.updateTelescope(this.telescopeModel);
      }
    });

    attachOverlayBrowserView(this.window, this.telescopeView);
    this.relayout();
  }

  initializeStatuslineView() {
    if (!this.window) return;

    this.statuslineView = createOverlayBrowserView(STATUSLINE_OVERLAY_HTML);

    this.statuslineView.setAutoResize({ width: true, height: false });

    this.statuslineView.webContents.on("did-finish-load", () => {
      this.statuslineReady = true;
      this.applyThemeToWebContents(this.statuslineView.webContents);
      this.updateStatuslineMode(this.statuslineMode);
      this.updateStatuslineScroll(this.statuslineScroll);
      this.updateStatuslineSplitIndicator(this.statuslineSplitIndicator);
    });

    attachOverlayBrowserView(this.window, this.statuslineView);
    this.relayout();
  }

  initializeToastOverlayView() {
    if (!this.window) return;

    this.toastOverlayView = createOverlayBrowserView(TOAST_OVERLAY_HTML);

    this.toastOverlayView.setAutoResize({ width: false, height: false });

    this.toastOverlayView.webContents.on("did-finish-load", () => {
      this.toastOverlayReady = true;
      this.applyThemeToWebContents(this.toastOverlayView.webContents);
      this.flushPendingToasts();
    });

    attachOverlayBrowserView(this.window, this.toastOverlayView);
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
        this.tablineOptions,
      );
    }, 16);
  }

  setTheme(nextTheme = {}) {
    this.currentTheme = {
      ...DEFAULT_THEME,
      ...(nextTheme && typeof nextTheme === "object" ? nextTheme : {}),
    };

    this.applyThemeToWebContents(this.window && this.window.webContents);
    this.applyThemeToWebContents(
      this.commandOverlayView && this.commandOverlayView.webContents,
    );
    this.applyThemeToWebContents(
      this.whichKeyOverlayView && this.whichKeyOverlayView.webContents,
    );
    this.applyThemeToWebContents(
      this.selectionModalView && this.selectionModalView.webContents,
    );
    this.applyThemeToWebContents(
      this.telescopeView && this.telescopeView.webContents,
    );
    this.applyThemeToWebContents(
      this.statuslineView && this.statuslineView.webContents,
    );
    this.applyThemeToWebContents(
      this.toastOverlayView && this.toastOverlayView.webContents,
    );
    this.renderTabline(this.pendingTablineSnapshot);
    this.renderUrlline(this.urllineModel);
    this.updateStatuslineSplitIndicator(this.statuslineSplitIndicator);
    this.updateSplitDivider(this.splitDividerState);
  }

  updateSplitDivider(splitStatus = {}) {
    const divider =
      splitStatus.divider && typeof splitStatus.divider === "object"
        ? splitStatus.divider
        : {};
    const visible = Boolean(divider.visible);
    const offsetPx = Number.isFinite(divider.offsetPx)
      ? Math.max(0, Math.floor(divider.offsetPx))
      : 0;

    this.splitDividerState = {
      visible,
      offsetPx,
    };

    if (!this.window || !this.shellHostReady) return;

    pushShellPatch(
      this.window.webContents,
      `
      (function updateSplitDivider() {
        const divider = document.getElementById('split-divider');
        if (!divider) return;
        const visible = ${JSON.stringify(visible)};
        const offsetPx = ${JSON.stringify(offsetPx)};
        divider.style.display = visible ? 'block' : 'none';
        divider.style.left = visible ? offsetPx + 'px' : '0px';
      })();
    `,
    );
  }

  applyThemeToWebContents(webContents) {
    if (!webContents || webContents.isDestroyed()) return;

    const cssVars = {
      ...toCssVars(this.currentTheme),
      "--ui-font-family": this.currentTheme.fontFamily,
    };

    pushShellPatch(
      webContents,
      `
      (function applyNoctraThemeVars() {
        const vars = ${JSON.stringify(cssVars)};
        const style = document.documentElement && document.documentElement.style;
        if (!style) return;

        for (const [name, value] of Object.entries(vars)) {
          if (typeof name !== 'string' || typeof value !== 'string') continue;
          style.setProperty(name, value);
        }
      })();
    `,
    );
  }

  setTablineActions(actions = {}) {
    this.tablineActions = {
      ...actions,
    };
    this.renderTabline(this.pendingTablineSnapshot);
  }

  setTablineOptions(options = {}) {
    this.tablineOptions = {
      ...this.tablineOptions,
      ...(options && typeof options === "object" ? options : {}),
    };
    this.renderTabline(this.pendingTablineSnapshot);
  }

  renderUrlline(model = { panes: [] }) {
    this.urllineModel =
      model && typeof model === "object" ? model : { panes: [] };

    if (!this.window || !this.shellHostReady) return;

    renderShellUrlline(
      this.window.webContents,
      this.urllineModel,
      this.urllineActions,
      this.currentTheme,
    );
  }

  setUrllineActions(actions = {}) {
    this.urllineActions = {
      ...actions,
    };
    this.renderUrlline(this.urllineModel);
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
    applyOverlayLayout({
      windowRef: this.window,
      overlays: {
        commandOverlayView: this.commandOverlayView,
        whichKeyOverlayView: this.whichKeyOverlayView,
        selectionModalView: this.selectionModalView,
        telescopeView: this.telescopeView,
        statuslineView: this.statuslineView,
        toastOverlayView: this.toastOverlayView,
      },
      visibility: {
        commandVisible: this.commandVisible,
        whichKeyVisible: this.whichKeyVisible,
        selectionModalVisible: this.selectionModalVisible,
        telescopeVisible: this.telescopeVisible,
      },
      chrome: {
        UI_SHELL_TABLINE_HEIGHT,
        UI_SHELL_STATUSLINE_HEIGHT,
      },
      computeSelectionModalHeight: () => this.computeSelectionModalHeight(this.selectionModalModel),
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
    applyOverlayStack(this.window, {
      statuslineView: this.statuslineView,
      whichKeyVisible: this.whichKeyVisible,
      whichKeyOverlayView: this.whichKeyOverlayView,
      selectionModalVisible: this.selectionModalVisible,
      selectionModalView: this.selectionModalView,
      telescopeVisible: this.telescopeVisible,
      telescopeView: this.telescopeView,
      commandVisible: this.commandVisible,
      commandOverlayView: this.commandOverlayView,
      toastOverlayView: this.toastOverlayView,
    });

    this.relayout();
  }

  isCommandVisible() {
    return this.commandVisible;
  }

  showCommand(text = "", cursorIndex = null, context = "shell") {
    this.commandVisible = true;
    this.commandContext = context === "editor" ? "editor" : "shell";
    this.commandText = text;
    this.commandCursorIndex = Number.isFinite(cursorIndex)
      ? Math.max(0, Math.min(Math.trunc(cursorIndex), String(text).length))
      : String(text).length;
    this.keepCommandOverlayAboveContentViews();
    this.updateCommand(text, this.commandCursorIndex, this.commandContext);
  }

  hideCommand() {
    this.commandVisible = false;
    this.commandText = "";
    this.commandCursorIndex = 0;
    this.commandContext = "shell";
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

    pushShellPatch(this.whichKeyOverlayView.webContents, `
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
        const maxRowsPerColumn = 5;
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

  isSelectionModalVisible() {
    return this.selectionModalVisible;
  }

  showSelectionModal(model) {
    this.selectionModalVisible = true;
    this.selectionModalModel = model || null;
    this.syncOverlayStack();
    this.updateSelectionModal(this.selectionModalModel);
  }

  hideSelectionModal() {
    this.selectionModalVisible = false;
    this.selectionModalModel = null;
    this.relayout();
  }

  updateSelectionModal(model) {
    this.selectionModalModel = model || this.selectionModalModel || null;
    if (!this.selectionModalVisible) return;
    if (!this.selectionModalView || !this.selectionModalReady) return;

    const safeModel = {
      title: String(this.selectionModalModel?.title || "Bookmark"),
      promptTitle: String(this.selectionModalModel?.promptTitle || ""),
      urlLine: String(this.selectionModalModel?.urlLine || ""),
      scopeLabel: String(this.selectionModalModel?.scopeLabel || ""),
      items: Array.isArray(this.selectionModalModel?.items)
        ? this.selectionModalModel.items.map((item) => String(item || ""))
        : [],
      indexHints: Array.isArray(this.selectionModalModel?.indexHints)
        ? this.selectionModalModel.indexHints.map((item) => String(item || ""))
        : [],
      selectedIndex: Number.isFinite(this.selectionModalModel?.selectedIndex)
        ? Math.max(0, Math.floor(this.selectionModalModel.selectedIndex))
        : -1,
      footerLeft: String(this.selectionModalModel?.footerLeft || ""),
      footerRight: String(this.selectionModalModel?.footerRight || ""),
    };

    pushShellPatch(this.selectionModalView.webContents, `
      (function updateSelectionModal() {
        const titleNode = document.getElementById('selection-modal-title');
        const promptNode = document.getElementById('selection-modal-prompt');
        const urlNode = document.getElementById('selection-modal-url');
        const scopeNode = document.getElementById('selection-modal-scope');
        const contentNode = document.getElementById('selection-modal-content');
        const footerNode = document.getElementById('selection-modal-footer');
        if (!titleNode || !promptNode || !urlNode || !scopeNode || !contentNode || !footerNode) return;

        const escapeHtml = (value) => String(value)
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#39;');

        const model = ${JSON.stringify(safeModel)};
        titleNode.textContent = model.title;
        promptNode.textContent = model.promptTitle;
        urlNode.textContent = model.urlLine;
        scopeNode.textContent = model.scopeLabel;

        const items = Array.isArray(model.items) ? model.items : [];
        const indexHints = Array.isArray(model.indexHints) ? model.indexHints : [];

        if (!items.length) {
          contentNode.innerHTML = '<div class="selection-modal-empty">no options</div>';
        } else {
          const maxLen = Math.max(items.length, indexHints.length);
          const columns = [];
          const selectedIndex = Number.isFinite(model.selectedIndex) ? model.selectedIndex : -1;
          for (let i = 0; i < maxLen; i += 1) {
            const item = escapeHtml(items[i] || '');
            const hint = escapeHtml(indexHints[i] || '');
            const selectedClass = i === selectedIndex ? ' selected' : '';
            columns.push('<span class="selection-modal-col"><span class="selection-modal-item' + selectedClass + '">' + item + '</span><span class="selection-modal-index">' + hint + '</span></span>');
          }
          contentNode.innerHTML = '<div class="selection-modal-grid">' + columns.join('') + '</div>';
        }

        footerNode.innerHTML = '<span>' + escapeHtml(model.footerLeft) + '</span><span>' + escapeHtml(model.footerRight) + '</span>';
      })();
    `);

    this.relayout();
  }

  isTelescopeVisible() {
    return this.telescopeVisible;
  }

  showTelescope(model) {
    this.telescopeVisible = true;
    this.telescopeModel = model || null;
    this.syncOverlayStack();
    this.updateTelescope(this.telescopeModel);
  }

  hideTelescope() {
    this.telescopeVisible = false;
    this.telescopeModel = null;
    this.relayout();
  }

  updateTelescope(model) {
    this.telescopeModel = model || this.telescopeModel || null;
    if (!this.telescopeVisible) return;
    if (!this.telescopeView || !this.telescopeReady) return;

    const safeModel = {
      title: String(this.telescopeModel?.title || "Find"),
      query: String(this.telescopeModel?.query || ""),
      counter: String(this.telescopeModel?.counter || "0 / 0"),
      promptPosition: String(this.telescopeModel?.promptPosition || "top"),
      items: Array.isArray(this.telescopeModel?.items)
        ? this.telescopeModel.items.map((item) => ({
            primary: String(item?.primary || ""),
            rightText: String(item?.rightText || ""),
            selected: Boolean(item?.selected),
          }))
        : [],
    };

    pushShellPatch(this.telescopeView.webContents, `
      (function updateTelescope() {
        const titleNode = document.getElementById('telescope-prompt-title');
        const queryNode = document.getElementById('telescope-query');
        const counterNode = document.getElementById('telescope-counter');
        const listNode = document.getElementById('telescope-list');
        if (!titleNode || !queryNode || !counterNode || !listNode) return;

        const escapeHtml = (value) => String(value)
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#39;');

        const model = ${JSON.stringify(safeModel)};
        const root = document.getElementById('telescope-shell');
        titleNode.textContent = model.title;
        queryNode.textContent = model.query;
        counterNode.textContent = model.counter;
        if (root) {
          root.style.flexDirection = model.promptPosition === 'bottom' ? 'column-reverse' : 'column';
        }

        if (!Array.isArray(model.items) || model.items.length === 0) {
          listNode.innerHTML = '<div class="telescope-empty">No match</div>';
          return;
        }

        listNode.innerHTML = model.items.map((item) => {
          const selected = item.selected ? ' selected' : '';
          return '<div class="telescope-row' + selected + '">' +
            '<span class="telescope-cursor"></span>' +
            '<span class="telescope-primary">' + escapeHtml(item.primary) + '</span>' +
            '<span class="telescope-right">' + escapeHtml(item.rightText) + '</span>' +
          '</div>';
        }).join('');

        const active = listNode.querySelector('.telescope-row.selected');
        if (active && typeof active.scrollIntoView === 'function') {
          active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      })();
    `);

    this.relayout();
  }

  computeSelectionModalHeight(model = null) {
    const activeModel = model || this.selectionModalModel || {};
    const hasPrompt = Boolean(String(activeModel.promptTitle || "").trim());
    const hasUrl = Boolean(String(activeModel.urlLine || "").trim());
    const hasScope = Boolean(String(activeModel.scopeLabel || "").trim());
    const hasFooter = Boolean(
      String(activeModel.footerLeft || "").trim() ||
        String(activeModel.footerRight || "").trim(),
    );
    const itemCount = Array.isArray(activeModel.items)
      ? activeModel.items.length
      : 0;

    const base = 38;
    const prompt = hasPrompt ? 16 : 0;
    const url = hasUrl ? 14 : 0;
    const scope = hasScope ? 14 : 0;
    const content = itemCount > 0 ? 38 : 22;
    const footer = hasFooter ? 14 : 0;

    const total = base + prompt + url + scope + content + footer;
    return Math.max(108, Math.min(210, total));
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

    pushShellPatch(this.statuslineView.webContents, `
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

    pushShellPatch(this.statuslineView.webContents, `
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

    pushShellPatch(this.statuslineView.webContents, `
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

  updateCommand(text = "", cursorIndex = null, context = null) {
    const nextText = String(text);
    const maxCursor = nextText.length;
    const nextCursor = Number.isFinite(cursorIndex)
      ? Math.max(0, Math.min(Math.trunc(cursorIndex), maxCursor))
      : maxCursor;

    if (typeof context === "string") {
      this.commandContext = context === "editor" ? "editor" : "shell";
    }

    this.commandText = nextText;
    this.commandCursorIndex = nextCursor;

    if (!this.commandOverlayView || !this.commandOverlayReady) return;

    const beforeText = nextText.slice(0, nextCursor);
    const afterText = nextText.slice(nextCursor);
    const cursorClass =
      nextCursor < nextText.length ? "cursor-bar" : "cursor-block";
    const isEditorContext = this.commandContext === "editor";
    const commandTitle = isEditorContext ? "Ex" : "Cmdline";
    const commandPrefix = "";

    pushShellPatch(this.commandOverlayView.webContents, `
      (function updateCommandOverlayText() {
        const titleNode = document.getElementById('command-title');
        const prefixNode = document.getElementById('command-prefix');
        const beforeNode = document.getElementById('command-text-before');
        const afterNode = document.getElementById('command-text-after');
        const cursorNode = document.getElementById('command-cursor');
        if (!titleNode || !prefixNode || !beforeNode || !afterNode || !cursorNode) return;
        titleNode.textContent = ${JSON.stringify(commandTitle)};
        prefixNode.textContent = ${JSON.stringify(commandPrefix)};
        beforeNode.textContent = ${JSON.stringify(beforeText)};
        afterNode.textContent = ${JSON.stringify(afterText)};
        cursorNode.className = ${JSON.stringify(cursorClass)};
      })();
    `);
  }
}

module.exports = new UiShellManager();

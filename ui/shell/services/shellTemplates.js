const {
  UI_SHELL_TABLINE_HEIGHT,
  UI_SHELL_STATUSLINE_HEIGHT,
  UI_FONT_FAMILY,
  UI_FONT_FACE_CSS,
  UI_TREE_LAYOUT,
} = require("../../constants");

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
        pointer-events: auto;
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
        pointer-events: auto;
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
        cursor: pointer;
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
        pointer-events: auto;
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
        cursor: text;
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
        cursor: pointer;
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
    <script>
      (function preventStatuslineContextMenu() {
        document.addEventListener('contextmenu', function(event) {
          event.preventDefault();
          return false;
        });
      })();
    </script>
  </body>
</html>
`;

const DOWNLOADS_MODAL_OVERLAY_HTML = `
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

      #downloads-modal {
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
        pointer-events: auto;
      }

      #downloads-modal-title {
        align-self: center;
        margin: 0 auto;
        padding: 0 8px;
        color: var(--ui-text-muted, #7d8aa3);
        background: var(--ui-bg-panel, #161b24);
        font-size: 12px;
        line-height: 1;
      }

      #downloads-modal-list {
        min-height: 0;
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
        overflow-y: auto;
        overflow-x: hidden;
      }

      .downloads-modal-empty {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--ui-text-muted, #7d8aa3);
        font-size: 12px;
      }

      .downloads-modal-row {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 22px;
        line-height: 18px;
        padding: 2px 6px;
        border-radius: 4px;
        color: var(--ui-text-soft, #b6c7e8);
        font-size: 12px;
        cursor: pointer;
      }

      .downloads-modal-row.selected {
        background: color-mix(in srgb, var(--ui-bg-subtle, #1f2735) 58%, transparent);
        color: var(--ui-text-bright, #f4f7ff);
      }

      .downloads-modal-glyph {
        flex: 0 0 auto;
        width: 1.2em;
        text-align: center;
      }

      .downloads-modal-filename {
        min-width: 0;
        flex: 1;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .downloads-modal-bar {
        flex: 0 0 auto;
        color: var(--ui-accent, #89dceb);
        font-size: 11px;
        line-height: 1;
        white-space: pre;
      }

      .downloads-modal-right {
        flex: 0 0 auto;
        color: var(--ui-text-muted, #7d8aa3);
        white-space: nowrap;
        text-align: right;
        font-size: 11px;
      }

      .downloads-modal-row.selected .downloads-modal-right {
        color: var(--ui-text-soft, #b6c7e8);
      }

      #downloads-modal-footer {
        display: flex;
        justify-content: space-between;
        color: var(--ui-text-muted, #7d8aa3);
        font-size: 11px;
      }
    </style>
  </head>
  <body>
    <fieldset id="downloads-modal">
      <legend id="downloads-modal-title">Downloads</legend>
      <div id="downloads-modal-list"></div>
      <div id="downloads-modal-footer"></div>
    </fieldset>
  </body>
</html>
`;

const BACKDROP_OVERLAY_HTML = `
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
      }

      #overlay-backdrop {
        width: 100%;
        height: 100%;
        background: transparent;
      }
    </style>
  </head>
  <body>
    <div id="overlay-backdrop"></div>
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
        pointer-events: auto;
        cursor: pointer;
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

module.exports = {
  SHELL_HTML,
  COMMAND_OVERLAY_HTML,
  WHICHKEY_OVERLAY_HTML,
  SELECTION_MODAL_OVERLAY_HTML,
  TELESCOPE_OVERLAY_HTML,
  STATUSLINE_OVERLAY_HTML,
  TOAST_OVERLAY_HTML,
  DOWNLOADS_MODAL_OVERLAY_HTML,
  BACKDROP_OVERLAY_HTML,
};

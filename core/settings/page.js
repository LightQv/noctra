const { UI_FONT_FAMILY, UI_FONT_FACE_CSS } = require("../../ui/constants");

const CODEMIRROR_CSS_URL = "https://cdn.jsdelivr.net/npm/codemirror@5.65.16/lib/codemirror.css";
const CODEMIRROR_DIALOG_CSS_URL =
  "https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/dialog/dialog.css";
const CODEMIRROR_JS_URL = "https://cdn.jsdelivr.net/npm/codemirror@5.65.16/lib/codemirror.js";
const CODEMIRROR_SEARCH_CURSOR_JS_URL =
  "https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/search/searchcursor.js";
const CODEMIRROR_DIALOG_JS_URL =
  "https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/dialog/dialog.js";
const CODEMIRROR_VIM_JS_URL = "https://cdn.jsdelivr.net/npm/codemirror@5.65.16/keymap/vim.js";
const CODEMIRROR_YAML_JS_URL = "https://cdn.jsdelivr.net/npm/codemirror@5.65.16/mode/yaml/yaml.js";

function buildSettingsPageHtml(configPath) {
  return `
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Settings</title>
    <link rel="stylesheet" href="${CODEMIRROR_CSS_URL}" />
    <link rel="stylesheet" href="${CODEMIRROR_DIALOG_CSS_URL}" />
    <style>
      ${UI_FONT_FACE_CSS}

      :root {
        color-scheme: dark;
      }

      html,
      body {
        margin: 0;
        width: 100%;
        height: 100%;
        background: #0f131a;
        color: #d8e3f8;
        font-family: ${UI_FONT_FAMILY};
      }

      body {
        display: grid;
        grid-template-rows: auto 1fr;
        min-height: 0;
      }

      #topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 8px 12px;
        border-bottom: 1px solid #2a3140;
        background: #141922;
      }

      #meta {
        display: inline-flex;
        align-items: baseline;
        gap: 8px;
        min-width: 0;
      }

      #title {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #8ea4d4;
      }

      #path {
        font-size: 12px;
        color: #aebfe2;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      #editor-mode {
        display: inline-flex;
        align-items: center;
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px solid #3a4a65;
        color: #6de3c4;
        font-size: 11px;
        line-height: 1;
      }

      #actions {
        display: inline-flex;
        gap: 8px;
      }

      .action-btn {
        border: 1px solid #2f3c53;
        border-radius: 6px;
        background: #1a2230;
        color: #c5d5f2;
        font-family: inherit;
        font-size: 12px;
        padding: 4px 9px;
        cursor: pointer;
      }

      #editor-root {
        width: 100%;
        height: 100%;
        min-height: 0;
      }

      .CodeMirror {
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        background: #10151d;
        color: #e7eefb;
        font-family: ${UI_FONT_FAMILY};
        font-size: 13px;
        line-height: 1.55;
      }

      .CodeMirror-gutters {
        border-right: 1px solid #242c38;
        background: #0f131a;
      }

      .CodeMirror-linenumber {
        color: #5f6d86;
      }

      .CodeMirror-cursor {
        border-left: 1px solid #89dceb;
      }

      .CodeMirror-selected {
        background: rgba(137, 220, 235, 0.22);
      }

      .CodeMirror-dialog {
        background: #141a23;
        border-bottom: 1px solid #2a3240;
        color: #d8e3f8;
      }

      .CodeMirror-dialog input {
        color: #d8e3f8;
      }
    </style>
  </head>
  <body>
    <div id="topbar">
      <div id="meta">
        <span id="title">Settings Buffer</span>
        <span id="path">${String(configPath || "")}</span>
        <span id="editor-mode">EDITOR:NORMAL</span>
      </div>
      <div id="actions">
        <button class="action-btn" id="save-btn" type="button" title=":w">Save</button>
        <button class="action-btn" id="reload-btn" type="button" title=":e">Reload</button>
      </div>
    </div>
    <div id="editor-root"></div>
    <script src="${CODEMIRROR_JS_URL}"></script>
    <script src="${CODEMIRROR_SEARCH_CURSOR_JS_URL}"></script>
    <script src="${CODEMIRROR_DIALOG_JS_URL}"></script>
    <script src="${CODEMIRROR_VIM_JS_URL}"></script>
    <script src="${CODEMIRROR_YAML_JS_URL}"></script>
    <script>
      (function settingsEditorBoot() {
        const root = document.getElementById("editor-root");
        const modeBadge = document.getElementById("editor-mode");
        const saveBtn = document.getElementById("save-btn");
        const reloadBtn = document.getElementById("reload-btn");

        if (!root || !window.uiShell || typeof window.CodeMirror === "undefined") return;

        const editor = window.CodeMirror(root, {
          value: "",
          mode: "yaml",
          keyMap: "vim",
          lineNumbers: true,
          lineWrapping: false,
          indentUnit: 2,
          tabSize: 2,
          autofocus: true,
        });

        let mode = "NORMAL";
        let pendingLeader = false;
        let pendingLeaderTimer = null;
        let leaderKey = "Space";

        const isLeaderStroke = (event) => {
          if (leaderKey === "Space") {
            return event.key === " " || event.key === "Spacebar";
          }

          return String(event.key || "").toLowerCase() === String(leaderKey).toLowerCase();
        };

        const setMode = (next) => {
          mode = next;
          modeBadge.textContent = "EDITOR:" + mode;
          window.uiShell.emit("editor:mode-change", { mode });
        };

        editor.on("vim-mode-change", (event) => {
          const rawMode = event && typeof event.mode === "string" ? event.mode : "normal";
          const normalized = rawMode.toUpperCase();
          setMode(normalized);
        });

        const setLeaderPending = () => {
          pendingLeader = true;
          if (pendingLeaderTimer) {
            clearTimeout(pendingLeaderTimer);
          }
          pendingLeaderTimer = setTimeout(() => {
            pendingLeader = false;
            pendingLeaderTimer = null;
          }, 500);
        };

        const clearLeaderPending = () => {
          pendingLeader = false;
          if (pendingLeaderTimer) {
            clearTimeout(pendingLeaderTimer);
            pendingLeaderTimer = null;
          }
        };

        const saveContent = async () => {
          await window.uiShell.invoke("settings:save", { content: editor.getValue() });
        };

        const reloadContent = async () => {
          const result = await window.uiShell.invoke("settings:get");
          if (!result || !result.ok) return;
          editor.setValue(typeof result.content === "string" ? result.content : "");
          editor.execCommand("goDocStart");
          leaderKey =
            typeof result.leaderKey === "string" && result.leaderKey.trim().length > 0
              ? result.leaderKey.trim()
              : "Space";
        };

        const focusEditor = () => {
          editor.focus();
          window.uiShell.emit("editor:focus-request");
        };

        window.__settingsEditorFocus__ = () => {
          editor.focus();
        };

        window.__settingsEditorBlur__ = () => {
          editor.getInputField().blur();
        };

        const onEditorKeyDown = (event) => {
          if (mode === "INSERT") {
            return;
          }

          if (pendingLeader) {
            const isTab = event.key === "Tab";
            clearLeaderPending();
            if (isTab) {
              event.preventDefault();
              event.stopImmediatePropagation();
              window.uiShell.emit("editor:toggle-context");
            }
            return;
          }

          if (isLeaderStroke(event)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            setLeaderPending();
            return;
          }

          if (event.key === "Escape") {
            clearLeaderPending();
          }

          if (event.key === "s" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            saveContent().catch(() => {});
          }
        };

        editor.getWrapperElement().addEventListener("keydown", onEditorKeyDown, true);
        editor.getWrapperElement().addEventListener("mousedown", () => {
          focusEditor();
        });

        saveBtn.addEventListener("click", () => {
          saveContent().catch(() => {});
        });

        reloadBtn.addEventListener("click", () => {
          reloadContent().catch(() => {});
        });

        window.addEventListener("focus", () => {
          focusEditor();
        });

        reloadContent().then(() => {
          focusEditor();
        }).catch(() => {
          focusEditor();
        });
      })();
    </script>
  </body>
</html>
  `;
}

module.exports = {
  buildSettingsPageHtml,
};

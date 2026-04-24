const { UI_FONT_FAMILY, UI_FONT_FACE_CSS } = require("../../ui/constants");
const { resolveTheme, toCssVars } = require("../../ui/theme");

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

function buildSettingsPageHtml(configPath, themeInput = null) {
  const theme = resolveTheme({ overrides: themeInput || {} });
  const themeVars = toCssVars(theme);
  const initialThemeVars = JSON.stringify(themeVars);
  const initialThemeCss = Object.entries(themeVars)
    .map(([name, value]) => `${name}: ${value};`)
    .join("\n        ");

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
        --ui-font-family: ${UI_FONT_FAMILY};
        ${initialThemeCss}
      }

      html,
      body {
        margin: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: var(--ui-bg-app);
        color: var(--ui-text);
        font-family: var(--ui-font-family);
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
        border-bottom: 1px solid var(--ui-border-strong);
        background: var(--ui-bg-panel);
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
        color: var(--ui-text-muted);
      }

      #path {
        font-size: 12px;
        color: var(--ui-text-soft);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      #actions {
        display: inline-flex;
        gap: 8px;
      }

      .action-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border: 1px solid var(--ui-border);
        border-radius: 4px;
        background: var(--ui-bg-elevated);
        color: var(--ui-text);
        font-family: inherit;
        font-size: 16px;
        line-height: 1;
        padding: 0;
        cursor: pointer;
      }

      #editor-root {
        width: 100%;
        height: 100%;
        min-height: 0;
        overflow: hidden;
      }

      .CodeMirror {
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        background: var(--ui-editor-bg);
        color: var(--ui-text);
        font-family: var(--ui-font-family);
        font-size: 13px;
        line-height: 20px;
      }

      .CodeMirror-gutters {
        border-right: 1px solid var(--ui-editor-gutter-border);
        background: var(--ui-editor-gutter-bg);
      }

      .CodeMirror-linenumber {
        color: var(--ui-editor-line-number);
      }

      .CodeMirror-cursor {
        border-left: 1px solid var(--ui-accent);
      }

      .CodeMirror-selected {
        background: var(--ui-editor-selection);
      }

      .CodeMirror-dialog {
        background: var(--ui-editor-dialog-bg);
        border-bottom: 1px solid var(--ui-editor-dialog-border);
        color: var(--ui-text);
      }

      .CodeMirror-dialog input {
        color: var(--ui-text);
      }
    </style>
  </head>
  <body>
      <div id="topbar">
        <div id="meta">
          <span id="title">FILEPATH</span>
          <span id="path">${String(configPath || "")}</span>
        </div>
        <div id="actions">
          <button class="action-btn" id="save-btn" type="button" title=":w" aria-label="Save">󰆓</button>
          <button class="action-btn" id="reload-btn" type="button" title=":e" aria-label="Reload">󰑐</button>
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
        const initialThemeVars = ${initialThemeVars};
        const root = document.getElementById("editor-root");
        const saveBtn = document.getElementById("save-btn");
        const reloadBtn = document.getElementById("reload-btn");

        if (!root || !window.uiShell || typeof window.CodeMirror === "undefined") return;

        const applyThemeVars = (vars) => {
          if (!vars || typeof vars !== "object") return;
          const style = document.documentElement.style;
          for (const [name, value] of Object.entries(vars)) {
            if (typeof name !== "string" || typeof value !== "string") continue;
            style.setProperty(name, value);
          }
        };

        applyThemeVars(initialThemeVars);

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

        const defineVimExCommand = (name, shortName, handler) => {
          if (!window.CodeMirror || !window.CodeMirror.Vim) return;
          try {
            window.CodeMirror.Vim.defineEx(name, shortName, handler);
          } catch {
            // ignore duplicate defineEx in repeated document sessions
          }
        };

        if (!window.__settingsEditorExDefined__) {
          defineVimExCommand("write", "w", () => {
            saveContent().catch(() => {});
          });
          defineVimExCommand("edit", "e", () => {
            reloadContent().catch(() => {});
          });
          defineVimExCommand("quit", "q", () => {
            window.uiShell.invoke("settings:close").catch(() => {});
          });
          defineVimExCommand("wq", "wq", () => {
            saveContent()
              .then(() => window.uiShell.invoke("settings:close"))
              .catch(() => {});
          });
          defineVimExCommand("xit", "x", () => {
            saveContent()
              .then(() => window.uiShell.invoke("settings:close"))
              .catch(() => {});
          });
          window.__settingsEditorExDefined__ = true;
        }

        let mode = "NORMAL";
        let pendingLeader = false;
        let pendingLeaderTimer = null;
        let leaderKey = "Space";
        let didNotifyReady = false;
        let useRelativeLineNumbers = true;
        let scrolloffLines = 3;

        const getLineHeight = () => Math.max(editor.defaultTextHeight() || 0, 1);

        const getEffectiveScrolloffLines = () => {
          const requested = Math.max(0, Number.parseInt(scrolloffLines, 10) || 0);
          const scrollInfo = editor.getScrollInfo();
          const lineHeight = getLineHeight();
          const visibleLines = Math.max(Math.floor(scrollInfo.clientHeight / lineHeight), 1);
          const maxAllowed = Math.max(Math.floor((visibleLines - 1) / 2), 0);
          return Math.min(requested, maxAllowed);
        };

        const notifyReady = () => {
          if (didNotifyReady) return;
          didNotifyReady = true;
          window.uiShell.emit("editor:ready");
        };

        const isLeaderStroke = (event) => {
          if (leaderKey === "Space") {
            return event.key === " " || event.key === "Spacebar";
          }

          return String(event.key || "").toLowerCase() === String(leaderKey).toLowerCase();
        };

        const setMode = (next) => {
          mode = next;
          window.uiShell.emit("editor:mode-change", { mode });
        };

        const lineNumberFormatter = (line) => {
          if (!useRelativeLineNumbers) {
            return String(line);
          }

          const cursor = editor.getCursor();
          const currentLine = cursor ? cursor.line + 1 : line;
          const relative = Math.abs(line - currentLine);
          return String(relative === 0 ? line : relative);
        };

        const applyLineNumbers = () => {
          editor.setOption("lineNumberFormatter", lineNumberFormatter);
          editor.refresh();
        };

        const snapEditorViewportToLineGrid = () => {
          const topbar = document.getElementById("topbar");
          const topbarHeight = topbar ? topbar.getBoundingClientRect().height : 0;
          const availableHeight = Math.max(window.innerHeight - topbarHeight, getLineHeight());
          const lineHeight = getLineHeight();
          const rowCount = Math.max(Math.floor(availableHeight / lineHeight), 1);
          const snappedHeight = rowCount * lineHeight;
          editor.setSize(null, snappedHeight);
        };

        const applyScrolloff = () => {
          const safeLines = getEffectiveScrolloffLines();
          const lineHeight = getLineHeight();
          const marginPx = safeLines * lineHeight;
          editor.setOption("cursorScrollMargin", marginPx);
        };

        const ensureCursorVisibleWithScrolloff = () => {
          const cursor = editor.getCursor();
          if (!cursor) return;

          const lineHeight = getLineHeight();
          const safeLines = getEffectiveScrolloffLines();
          const scrollInfo = editor.getScrollInfo();
          const coords = editor.charCoords(cursor, "local");
          const marginPx = safeLines * lineHeight;
          const topLimit = scrollInfo.top + marginPx;
          const bottomLimit = scrollInfo.top + scrollInfo.clientHeight - marginPx;

          if (coords.top < topLimit) {
            const targetTop = Math.max(0, coords.top - marginPx);
            editor.scrollTo(null, targetTop);
            return;
          }

          if (coords.bottom > bottomLimit) {
            const targetTop = Math.max(0, coords.bottom + marginPx - scrollInfo.clientHeight);
            editor.scrollTo(null, targetTop);
          }
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
          applyThemeVars(result.themeVars);
          editor.setValue(typeof result.content === "string" ? result.content : "");
          editor.execCommand("goDocStart");
          useRelativeLineNumbers = result.relativeLineNumbers !== false;
          scrolloffLines = Math.max(0, Number.parseInt(result.scrolloffLines, 10) || 0);
          snapEditorViewportToLineGrid();
          applyLineNumbers();
          applyScrolloff();
          ensureCursorVisibleWithScrolloff();
          leaderKey =
            typeof result.leaderKey === "string" && result.leaderKey.trim().length > 0
              ? result.leaderKey.trim()
              : "Space";
        };

        if (typeof window.uiShell.on === "function") {
          window.uiShell.on("theme:update", (payload) => {
            applyThemeVars(payload && payload.themeVars);
          });
        }

        const focusEditorSurface = () => {
          editor.focus();
        };

        const enterEditorContext = () => {
          focusEditorSurface();
          window.uiShell.emit("editor:focus-request");
        };

        window.__settingsEditorFocus__ = () => {
          editor.focus();
        };

        window.__settingsEditorSetNormal__ = () => {
          if (
            window.CodeMirror &&
            window.CodeMirror.Vim &&
            typeof window.CodeMirror.Vim.exitInsertMode === "function"
          ) {
            window.CodeMirror.Vim.exitInsertMode(editor);
          }
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
        editor.on("cursorActivity", () => {
          if (useRelativeLineNumbers) {
            editor.refresh();
          }
          ensureCursorVisibleWithScrolloff();
        });
        editor.getWrapperElement().addEventListener("mousedown", () => {
          enterEditorContext();
        });

        saveBtn.addEventListener("click", () => {
          saveContent().catch(() => {});
        });

        reloadBtn.addEventListener("click", () => {
          reloadContent().catch(() => {});
        });

        window.addEventListener("focus", () => {
          focusEditorSurface();
        });

        window.addEventListener("resize", () => {
          snapEditorViewportToLineGrid();
          applyScrolloff();
          ensureCursorVisibleWithScrolloff();
        });

        reloadContent().then(() => {
          focusEditorSurface();
          notifyReady();
        }).catch(() => {
          focusEditorSurface();
          notifyReady();
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

const {
  UI_FONT_FAMILY,
  UI_FONT_FACE_CSS,
  UI_SHELL_TABLINE_HEIGHT,
  UI_CHROME_ICON_BUTTON_SIZE,
  UI_CHROME_BORDER_RADIUS,
  UI_CHROME_TAB_GAP,
  UI_CHROME_EDITOR_HEADER_HORIZONTAL_PADDING,
  UI_CHROME_ICON_GLYPH_SIZE,
} = require("../../ui/constants");
const fs = require("fs");
const { resolveTheme, toCssVars } = require("../../ui/theme");

function readCodeMirrorAsset(assetPath) {
  try {
    const resolved = require.resolve(assetPath);
    return fs.readFileSync(resolved, "utf8").replace(/<\/script/gi, "<\\/script");
  } catch {
    return "";
  }
}

const CODEMIRROR_CSS = readCodeMirrorAsset("codemirror/lib/codemirror.css");
const CODEMIRROR_JS = readCodeMirrorAsset("codemirror/lib/codemirror.js");
const CODEMIRROR_SEARCH_CURSOR_JS = readCodeMirrorAsset("codemirror/addon/search/searchcursor.js");
const CODEMIRROR_VIM_JS = readCodeMirrorAsset("codemirror/keymap/vim.js");
const CODEMIRROR_YAML_JS = readCodeMirrorAsset("codemirror/mode/yaml/yaml.js");

const SETTINGS_CSP =
  "default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; worker-src 'none'; media-src 'none'; manifest-src 'none'; frame-ancestors 'none'";

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildSettingsPageHtml(configPath, themeInput = null, initialContent = "", options = {}) {
  const viewTitle =
    typeof options.viewTitle === "string" && options.viewTitle.trim().length > 0
      ? options.viewTitle.trim()
      : "Settings";
  const sourceTheme =
    themeInput && typeof themeInput === "object" && themeInput.theme
      ? themeInput.theme
      : themeInput;
  const sourceColorScheme =
    themeInput && typeof themeInput === "object" && themeInput.colorScheme === "light"
      ? "light"
      : "dark";
  const theme = resolveTheme({
    mode: sourceColorScheme,
    overrides: sourceTheme || {},
  });
  const themeVars = toCssVars(theme);
  const initialThemeVars = JSON.stringify(themeVars);
  const initialColorScheme = JSON.stringify(sourceColorScheme);
  const initialContentJson = JSON.stringify(String(initialContent || ""));
  const escapedViewTitle = escapeHtml(viewTitle);
  const escapedConfigPath = escapeHtml(String(configPath || ""));
  const initialThemeCss = Object.entries(themeVars)
    .map(([name, value]) => `${name}: ${value};`)
    .join("\n        ");

  return `
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${SETTINGS_CSP}" />
    <title>${escapedViewTitle}</title>
    <style>
      ${CODEMIRROR_CSS}

      ${UI_FONT_FACE_CSS}

      :root {
        color-scheme: var(--ui-color-scheme, ${sourceColorScheme});
        --ui-color-scheme: ${sourceColorScheme};
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
        height: ${UI_SHELL_TABLINE_HEIGHT}px;
        padding: 0 ${UI_CHROME_EDITOR_HEADER_HORIZONTAL_PADDING}px;
        box-sizing: border-box;
        border-bottom: 1px solid var(--ui-border-strong);
        background: var(--ui-bg-shell);
      }

      #meta {
        display: inline-flex;
        align-items: baseline;
        gap: 8px;
        min-width: 0;
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
        gap: ${UI_CHROME_TAB_GAP}px;
      }

      .action-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: ${UI_CHROME_ICON_BUTTON_SIZE}px;
        height: ${UI_CHROME_ICON_BUTTON_SIZE}px;
        border: 1px solid var(--ui-border);
        border-radius: ${UI_CHROME_BORDER_RADIUS}px;
        background: var(--ui-bg-elevated);
        color: var(--ui-text);
        font-family: inherit;
        font-size: ${UI_CHROME_ICON_GLYPH_SIZE}px;
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
        border-left: 1px solid var(--ui-editor-cursor);
      }

      .CodeMirror div.CodeMirror-cursor {
        border-left: 1px solid var(--ui-editor-cursor) !important;
      }

      .CodeMirror.cm-fat-cursor div.CodeMirror-cursor {
        background: var(--ui-editor-cursor) !important;
        border: 0 !important;
        box-shadow: inset 0 0 0 1px var(--ui-editor-cursor-text);
      }

      .CodeMirror.cm-fat-cursor .CodeMirror-line::selection,
      .CodeMirror.cm-fat-cursor .CodeMirror-line > span::selection,
      .CodeMirror.cm-fat-cursor .CodeMirror-line > span > span::selection {
        background: var(--ui-editor-selection);
      }

      .CodeMirror-selected {
        background: var(--ui-editor-selection);
      }

      .CodeMirror-activeline-background {
        background: var(--ui-editor-active-line);
      }

      .CodeMirror-matchingbracket {
        background: var(--ui-editor-matching-bracket-bg);
        color: var(--ui-editor-matching-bracket-color) !important;
      }

      .CodeMirror-dialog {
        display: none !important;
      }

      .cm-s-default .cm-keyword {
        color: var(--ui-editor-token-keyword);
      }

      .cm-s-default .cm-atom {
        color: var(--ui-editor-token-atom);
      }

      .cm-s-default .cm-number {
        color: var(--ui-editor-token-number);
      }

      .cm-s-default .cm-def {
        color: var(--ui-editor-token-def);
      }

      .cm-s-default .cm-variable {
        color: var(--ui-editor-token-variable);
      }

      .cm-s-default .cm-variable-2 {
        color: var(--ui-editor-token-variable2);
      }

      .cm-s-default .cm-variable-3,
      .cm-s-default .cm-type {
        color: var(--ui-editor-token-variable3);
      }

      .cm-s-default .cm-property {
        color: var(--ui-editor-token-property);
      }

      .cm-s-default .cm-operator {
        color: var(--ui-editor-token-operator);
      }

      .cm-s-default .cm-comment {
        color: var(--ui-editor-token-comment);
      }

      .cm-s-default .cm-string {
        color: var(--ui-editor-token-string);
      }

      .cm-s-default .cm-string-2 {
        color: var(--ui-editor-token-string2);
      }

      .cm-s-default .cm-meta {
        color: var(--ui-editor-token-meta);
      }

      .cm-s-default .cm-qualifier {
        color: var(--ui-editor-token-qualifier);
      }

      .cm-s-default .cm-builtin {
        color: var(--ui-editor-token-builtin);
      }

      .cm-s-default .cm-tag {
        color: var(--ui-editor-token-tag);
      }

      .cm-s-default .cm-attribute {
        color: var(--ui-editor-token-attribute);
      }

      .cm-s-default .cm-header {
        color: var(--ui-editor-token-header);
      }

      .cm-s-default .cm-quote {
        color: var(--ui-editor-token-quote);
      }

      .cm-s-default .cm-link {
        color: var(--ui-editor-token-link);
      }

    </style>
  </head>
  <body>
      <div id="topbar">
        <div id="meta">
          <span id="path">${escapedConfigPath}</span>
        </div>
        <div id="actions">
          <button class="action-btn" id="save-btn" type="button" title=":w" aria-label="Save">󰆓</button>
          <button class="action-btn" id="reload-btn" type="button" title=":e" aria-label="Reload">󰑐</button>
        </div>
      </div>
    <div id="editor-root"></div>
    <script>
      ${CODEMIRROR_JS}
    </script>
    <script>
      ${CODEMIRROR_SEARCH_CURSOR_JS}
    </script>
    <script>
      ${CODEMIRROR_VIM_JS}
    </script>
    <script>
      ${CODEMIRROR_YAML_JS}
    </script>
    <script>
      (function settingsEditorBoot() {
        const initialThemeVars = ${initialThemeVars};
        const initialColorScheme = ${initialColorScheme};
        const root = document.getElementById("editor-root");
        const saveBtn = document.getElementById("save-btn");
        const reloadBtn = document.getElementById("reload-btn");

        if (!root || typeof window.CodeMirror === "undefined") return;

        const shell =
          window.settingsBridge && typeof window.settingsBridge === "object"
            ? window.settingsBridge
            : null;
        const invokeShell = (type, payload) => {
          if (!shell) {
            return Promise.resolve({ ok: false });
          }
          if (type === "settings:get" && typeof shell.get === "function") {
            return shell.get();
          }
          if (type === "settings:save" && typeof shell.save === "function") {
            return shell.save(payload?.content || "");
          }
          if (type === "settings:close" && typeof shell.close === "function") {
            return shell.close();
          }
          return Promise.resolve({ ok: false });
        };
        const emitShell = (type, payload) => {
          if (!shell) return;
          if (type === "editor:ready" && typeof shell.editorReady === "function") {
            shell.editorReady();
            return;
          }
          if (type === "editor:mode-change" && typeof shell.editorModeChange === "function") {
            shell.editorModeChange(payload?.mode);
            return;
          }
          if (type === "editor:focus-request" && typeof shell.editorFocusRequest === "function") {
            shell.editorFocusRequest();
            return;
          }
          if (type === "editor:open-command" && typeof shell.editorOpenCommand === "function") {
            shell.editorOpenCommand(payload?.initialText || "");
            return;
          }
          if (type === "editor:toggle-context" && typeof shell.editorToggleContext === "function") {
            shell.editorToggleContext();
          }
        };
        const onShell = (type, handler) => {
          if (!shell || typeof shell.onThemeUpdate !== "function") return;
          if (type === "theme:update") {
            shell.onThemeUpdate(handler);
          }
        };

        const applyThemeVars = (vars) => {
          if (!vars || typeof vars !== "object") return;
          const style = document.documentElement.style;
          for (const [name, value] of Object.entries(vars)) {
            if (typeof name !== "string" || typeof value !== "string") continue;
            style.setProperty(name, value);
          }
        };

        const applyColorScheme = (colorScheme) => {
          const next = colorScheme === "light" ? "light" : "dark";
          document.documentElement.style.setProperty("--ui-color-scheme", next);
          document.documentElement.style.colorScheme = next;
        };

        const applyThemePayload = (payload) => {
          if (!payload || typeof payload !== "object") return;
          if (payload.themeVars && typeof payload.themeVars === "object") {
            applyThemeVars(payload.themeVars);
          }
          applyColorScheme(payload.colorScheme);
        };

        applyThemeVars(initialThemeVars);
        applyColorScheme(initialColorScheme);

        const editor = window.CodeMirror(root, {
          value: ${initialContentJson},
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
            invokeShell("settings:close").catch(() => {});
          });
          defineVimExCommand("wq", "wq", () => {
            saveContent()
              .then(() => invokeShell("settings:close"))
              .catch(() => {});
          });
          defineVimExCommand("xit", "x", () => {
            saveContent()
              .then(() => invokeShell("settings:close"))
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
          emitShell("editor:ready");
        };

        const isLeaderStroke = (event) => {
          if (leaderKey === "Space") {
            return event.key === " " || event.key === "Spacebar";
          }

          return String(event.key || "").toLowerCase() === String(leaderKey).toLowerCase();
        };

        const setMode = (next) => {
          mode = next;
          emitShell("editor:mode-change", { mode });
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
          await invokeShell("settings:save", { content: editor.getValue() });
        };

        const runEditorCommand = (rawCommand) => {
          const text = String(rawCommand || "").trim().replace(/^:/, "").trim();
          if (!text) {
            return Promise.resolve();
          }

          if (
            window.CodeMirror &&
            window.CodeMirror.Vim &&
            typeof window.CodeMirror.Vim.handleEx === "function"
          ) {
            try {
              window.CodeMirror.Vim.handleEx(editor, text);
              return Promise.resolve();
            } catch {
              // fall back to local command handlers below
            }
          }

          const lowered = text.toLowerCase();
          if (lowered === "w" || lowered === "write") {
            return saveContent();
          }

          if (lowered === "e" || lowered === "edit") {
            return reloadContent();
          }

          if (lowered === "q" || lowered === "quit") {
            return invokeShell("settings:close");
          }

          if (lowered === "wq" || lowered === "x" || lowered === "xit") {
            return saveContent().then(() => invokeShell("settings:close"));
          }

          return Promise.resolve();
        };

        const loadBaselineContent = (content) => {
          editor.setValue(typeof content === "string" ? content : "");
          editor.clearHistory();
          editor.execCommand("goDocStart");
        };

        const reloadContent = async () => {
          const result = await invokeShell("settings:get");
          if (!result || !result.ok) return;
          applyThemePayload(result);
          loadBaselineContent(result.content);
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

        onShell("theme:update", (payload) => {
          applyThemePayload(payload);
        });

        const focusEditorSurface = () => {
          editor.focus();
        };

        const enterEditorContext = () => {
          focusEditorSurface();
          emitShell("editor:focus-request");
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

        window.__settingsEditorRunCommand__ = (commandText) => {
          runEditorCommand(commandText).catch(() => {});
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
              emitShell("editor:toggle-context");
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

          if (
            event.key === ":" &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
          ) {
            event.preventDefault();
            event.stopImmediatePropagation();
            emitShell("editor:open-command", { initialText: "" });
            return;
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

        if (shell && typeof shell.get === "function") {
          reloadContent().then(() => {
            focusEditorSurface();
            notifyReady();
          }).catch(() => {
            focusEditorSurface();
            notifyReady();
          });
        } else {
          loadBaselineContent(${initialContentJson});
          snapEditorViewportToLineGrid();
          applyLineNumbers();
          applyScrolloff();
          ensureCursorVisibleWithScrolloff();
          focusEditorSurface();
          notifyReady();
        }
      })();
    </script>
  </body>
</html>
  `;
}

module.exports = {
  buildSettingsPageHtml,
};

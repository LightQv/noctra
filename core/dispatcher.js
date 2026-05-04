const { app, nativeTheme } = require("electron");
const fs = require("fs");
const path = require("path");
const buffers = require("../browser/manager");
const uiShell = require("../ui/shell/manager");
const configService = require("./config/service");
const { INTENTS, isKnownIntentType } = require("./intents");
const { buildSearchUrl } = require("./resolver");
const historyService = require("./history/service");
const historyPanel = require("./history/panel");
const bookmarksService = require("./bookmarks/service");
const sessionService = require("./session/service");
const { buildSettingsPageHtml } = require("./settings/page");
const {
  resolveTheme,
  resolveThemeMode,
  resolveContentColorScheme,
  toCssVars,
} = require("../ui/theme");

function computeStatuslineModeLabel(state) {
  if (historyPanel.isVisible() && historyPanel.isFocused()) {
    return "TREE:NORMAL";
  }

  const active = buffers.getActive();
  if (!active || !active.isEditable) {
    return state.mode;
  }

  if (state.interactionContext === "EDITOR") {
    return `EDITOR:${state.editorMode || "NORMAL"}`;
  }

  return `SHELL:${state.mode}`;
}

function focusEditableBufferSurface(buffer) {
  if (!buffer || !buffer.isEditable || !buffer.webContents || buffer.webContents.isDestroyed()) {
    return;
  }

  buffer.webContents.executeJavaScript(
    `if (typeof window.__settingsEditorFocus__ === "function") { window.__settingsEditorFocus__(); }`,
  ).catch(() => {});

  if (buffer.webContents.isLoadingMainFrame()) {
    buffer.webContents.once("did-finish-load", () => {
      if (buffer.webContents.isDestroyed()) return;
      buffer.webContents.executeJavaScript(
        `if (typeof window.__settingsEditorFocus__ === "function") { window.__settingsEditorFocus__(); }`,
      ).catch(() => {});
    });
  }
}

function blurEditableBufferSurface(buffer) {
  if (!buffer || !buffer.isEditable || !buffer.webContents || buffer.webContents.isDestroyed()) {
    return;
  }

  buffer.webContents.executeJavaScript(
    `if (typeof window.__settingsEditorBlur__ === "function") { window.__settingsEditorBlur__(); }`,
  ).catch(() => {});
}

function runEditableExCommand(buffer, commandText) {
  if (!buffer || !buffer.isEditable || !buffer.webContents || buffer.webContents.isDestroyed()) {
    return;
  }

  buffer.webContents.executeJavaScript(
    `
      if (typeof window.__settingsEditorRunCommand__ === "function") {
        window.__settingsEditorRunCommand__(${JSON.stringify(String(commandText || ""))});
      }
    `,
  ).catch(() => {});
}

function openSettingsBuffer() {
  const existing = buffers.findByKind("editable");
  const configPath = configService.getConfigPath();

  if (existing) {
    buffers.switchTo(existing.id);
    return existing;
  }

  const themeConfig = configService.getConfigValue("global.theme", {});
  const resolvedMode = resolveThemeMode(themeConfig, {
    systemPrefersDark: nativeTheme.shouldUseDarkColors,
  });
  const theme = resolveTheme(themeConfig, {
    systemPrefersDark: nativeTheme.shouldUseDarkColors,
  });
  let initialContent = "";
  try {
    initialContent = fs.readFileSync(configPath, "utf8");
  } catch {
    initialContent = "";
  }
  const html = buildSettingsPageHtml(
    configPath,
    {
      theme,
      colorScheme: resolvedMode,
    },
    initialContent,
  );

  const buffer = buffers.create(null, {
    kind: "editable",
    activate: true,
    preloadPath: path.join(__dirname, "..", "ui", "shell", "preload.js"),
  });

  buffer.loadVirtualDocument({
    url: "noctra://settings/config.yml",
    title: "config.yml",
    html,
  });

  return buffer;
}

function normalizeUrl(rawUrl) {
  const value = rawUrl.trim();
  if (!value) return null;

  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value)) {
    return value;
  }

  return `https://${value}`;
}

function resolveCurrentThemeContext() {
  const themeConfig = configService.getConfigValue("global.theme", {});
  const resolvedMode = resolveThemeMode(themeConfig, {
    systemPrefersDark: nativeTheme.shouldUseDarkColors,
  });
  const theme = resolveTheme(themeConfig, {
    systemPrefersDark: nativeTheme.shouldUseDarkColors,
  });
  const contentColorScheme = resolveContentColorScheme(themeConfig, {
    systemPrefersDark: nativeTheme.shouldUseDarkColors,
  });

  return {
    theme,
    resolvedMode,
    contentColorScheme,
  };
}

function buildThemePayload(themeContext = {}) {
  const theme = themeContext.theme || {};
  const resolvedMode = themeContext.resolvedMode || "dark";
  return {
    theme,
    themeVars: toCssVars(theme),
    colorScheme: resolvedMode === "light" ? "light" : "dark",
    resolvedMode,
  };
}

function broadcastUiShellPush(win, type, payload = {}) {
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

function applyThemeEverywhere(win) {
  const themeContext = resolveCurrentThemeContext();
  const payload = buildThemePayload(themeContext);
  uiShell.setTheme(payload.theme);
  buffers.setContentUiOptions({
    thumbColor: payload.theme.scrollbarThumbColor,
    thumbActiveColor: payload.theme.scrollbarThumbActiveColor,
    contentColorScheme: themeContext.contentColorScheme === "light" ? "light" : "dark",
  });
  buffers.refreshDashboardBuffers();
  broadcastUiShellPush(win, "theme:update", payload);
}

function isReloadableWebBuffer(buffer) {
  if (!buffer || buffer.isEditable || !buffer.webContents || buffer.webContents.isDestroyed()) {
    return false;
  }

  const url = typeof buffer.url === "string" ? buffer.url.trim() : "";
  return url.startsWith("http://") || url.startsWith("https://");
}

function reloadReloadableBuffers() {
  for (const buffer of buffers.getBuffers()) {
    if (!isReloadableWebBuffer(buffer)) {
      continue;
    }
    buffer.webContents.reload();
  }
}

function dispatch(win, intent, state) {
  if (!intent) return;

  if (!isKnownIntentType(intent.type)) {
    console.warn("Unknown intent type:", intent.type, intent);
    return;
  }

  const buf = buffers.getActive();

  if (!buf) return;

  switch (intent.type) {
    case INTENTS.NOOP:
      break;

    case INTENTS.SCROLL:
      buf.webContents.executeJavaScript(`
        (function applyScroll() {
          const amount = ${Math.max(0, Number(intent.amount) || 0)};
          if (${JSON.stringify(intent.direction)} === "left") {
            window.scrollBy(-amount, 0);
            return;
          }
          if (${JSON.stringify(intent.direction)} === "right") {
            window.scrollBy(amount, 0);
            return;
          }
          window.scrollBy(0, ${JSON.stringify(intent.direction)} === "down" ? amount : -amount);
        })();
      `);
      break;

    case INTENTS.SCROLL_TOP:
      buf.webContents.executeJavaScript(
        `window.scrollTo({top: 0, behavior: "instant"})`,
      );
      break;

    case INTENTS.SCROLL_BOTTOM:
      buf.webContents.executeJavaScript(`
				window.scrollTo({
					top: document.documentElement.scrollHeight,
					behavior: "instant"
				});
			`);
      break;

    case INTENTS.PAGE_DOWN:
      buf.webContents.executeJavaScript(
        `window.scrollBy(0, Math.floor(window.innerHeight * 0.9))`,
      );
      break;

    case INTENTS.PAGE_UP:
      buf.webContents.executeJavaScript(
        `window.scrollBy(0, -Math.floor(window.innerHeight * 0.9))`,
      );
      break;

    case INTENTS.NAV_BACK:
      buf.webContents.navigationHistory.goBack();
      break;

    case INTENTS.NAV_FORWARD:
      buf.webContents.navigationHistory.goForward();
      break;

    case INTENTS.RELOAD_PAGE:
      buf.webContents.reload();
      break;

    case INTENTS.ENTER_INSERT:
    case INTENTS.ENTER_NORMAL:
      // state already changed in motion layer
      break;

    case INTENTS.SHOW_COMMAND:
      uiShell.showCommand(
        state.commandBuffer,
        state.commandCursorIndex,
        state.commandTarget === "EDITOR" ? "editor" : "shell",
      );
      buffers.focusActive();
      break;

    case INTENTS.HIDE_COMMAND:
      state.commandTarget = "SHELL";
      uiShell.hideCommand();
      buffers.focusActive();
      if (state.interactionContext === "EDITOR") {
        focusEditableBufferSurface(buffers.getActive());
      }
      break;

    case INTENTS.COMMAND_INPUT:
      uiShell.updateCommand(
        state.commandBuffer,
        state.commandCursorIndex,
        state.commandTarget === "EDITOR" ? "editor" : "shell",
      );
      break;

    case INTENTS.SUBMIT_EDITOR_COMMAND: {
      const activeEditableBuffer = buffers.getActive();
      runEditableExCommand(activeEditableBuffer, intent.command);
      break;
    }

    case INTENTS.SHOW_WHICHKEY:
      uiShell.showWhichKey(intent.model || null, intent.timeoutMs, intent.delayMs);
      break;

    case INTENTS.UPDATE_WHICHKEY:
      uiShell.updateWhichKey(intent.model || null, intent.timeoutMs, intent.delayMs);
      break;

    case INTENTS.HIDE_WHICHKEY:
      uiShell.hideWhichKey();
      break;

    case INTENTS.OPEN_URL_PROMPT:
      state.mode = "COMMAND";
      state.commandBuffer = "open ";
      state.commandCursorIndex = state.commandBuffer.length;
      state.commandTarget = "SHELL";
      dispatch(win, { type: INTENTS.SHOW_COMMAND }, state);
      dispatch(win, { type: INTENTS.COMMAND_INPUT }, state);
      break;

    case INTENTS.OPEN_URL: {
      const normalized = normalizeUrl(intent.url || "");
      if (!normalized) {
        console.warn("OPEN_URL intent missing URL", intent);
        break;
      }
      buf.load(normalized);
      break;
    }

    case INTENTS.SEARCH_WEB: {
      const searchUrl = buildSearchUrl(intent.engine, intent.query);
      if (!searchUrl) {
        console.warn("SEARCH_WEB intent has unknown engine", intent);
        break;
      }
      buf.load(searchUrl);
      break;
    }

    case INTENTS.NEW_BUFFER: {
      if (intent.url) {
        buffers.create(intent.url);
      } else {
        buffers.openConfiguredBuffer();
      }
      break;
    }

    case INTENTS.BUFFER_NEXT:
      buffers.switchByOffset(1);
      break;

    case INTENTS.BUFFER_PREV:
      buffers.switchByOffset(-1);
      break;

    case INTENTS.SWITCH_BUFFER:
      buffers.switchTo(intent.id);
      break;

    case INTENTS.CLOSE_BUFFER:
      buffers.close(intent.id ?? null);
      break;

    case INTENTS.REOPEN_BUFFER:
      buffers.reopenLastClosed();
      break;

    case INTENTS.CLOSE_FOCUSED:
      if (buffers.isSplitEnabled()) {
        buffers.closeRightSplit();
      } else {
        buffers.close();
      }
      break;

    case INTENTS.CLOSE_LEFT_BUFFERS:
      buffers.closeLeftOfActive();
      break;

    case INTENTS.CLOSE_RIGHT_BUFFERS:
      buffers.closeRightOfActive();
      break;

    case INTENTS.SPLIT_VERTICAL: {
      const ratio = configService.getConfigValue("global.split.regular_ratio", 0.5);
      buffers.openVerticalSplit(ratio);
      break;
    }

    case INTENTS.SPLIT_CLOSE_RIGHT:
      buffers.closeRightSplit();
      break;

    case INTENTS.SPLIT_DEVTOOLS: {
      const ratio = configService.getConfigValue("global.split.devtools_ratio", 0.25);
      buffers.openDevtoolsSplit(ratio);
      break;
    }

    case INTENTS.FOCUS_SPLIT_LEFT:
      buffers.focusSplitLeft();
      break;

    case INTENTS.FOCUS_SPLIT_RIGHT:
      buffers.focusSplitRight();
      break;

    case INTENTS.CONFIG_RELOAD: {
      const config = configService.reloadConfig();
      if (typeof state.applyConfig === "function") {
        state.applyConfig(config);
      }
      applyThemeEverywhere(win);
      uiShell.setTablineOptions({
        showFavicon: configService.getConfigValue("global.ui.tabline.show_favicon", false),
      });
      buffers.setUrllineVisible(configService.getConfigValue("global.ui.urlline.enabled", false));
      historyPanel.setWidthRatio(configService.getConfigValue("global.ui.sidepanel.width_ratio", 0.2));
      historyPanel.setTreeScrollContextLines(
        configService.getConfigValue("global.ui.sidepanel.tree_scroll_context_lines", 3),
      );
      historyPanel.setTreeDeleteOperatorTimeoutMs(
        configService.getConfigValue("global.ui.sidepanel.delete_operator_timeout_ms", 900),
      );
      historyPanel.layout();
      buffers.layoutViews();
      uiShell.updateSplitDivider(buffers.getSplitStatus());
      console.info("Configuration reloaded from", configService.getConfigPath());
      break;
    }

    case INTENTS.SET_THEME_MODE: {
      const mode = typeof intent.mode === "string" ? intent.mode : "";
      if (!["dark", "light", "auto", "custom"].includes(mode)) {
        console.warn("Unknown theme mode:", intent.mode);
        break;
      }

      const config = configService.updateThemeMode(mode);
      if (typeof state.applyConfig === "function") {
        state.applyConfig(config);
      }

      applyThemeEverywhere(win);
      console.info(`Theme mode set to ${mode}`);
      break;
    }

    case INTENTS.SET_BROWSER_LANGUAGE: {
      const language = typeof intent.language === "string" ? intent.language.trim().toLowerCase() : "";
      if (!["en", "fr"].includes(language)) {
        console.warn("Unknown browser language:", intent.language);
        break;
      }

      const config = configService.updateBrowserLanguage(language);
      if (typeof state.applyConfig === "function") {
        state.applyConfig(config);
      }

      if (intent.reload) {
        reloadReloadableBuffers();
      }

      console.info(
        intent.reload
          ? `Browser language set to ${language}. Reloaded web buffers.`
          : `Browser language set to ${language}. Reload with :lang ${language}! to apply on current pages.`,
      );
      break;
    }

    case INTENTS.OPEN_SETTINGS_BUFFER:
      focusEditableBufferSurface(openSettingsBuffer());
      buffers.focusActive();
      state.interactionContext = "EDITOR";
      state.editorMode = "NORMAL";
      break;

    case INTENTS.TOGGLE_FOCUS_CONTEXT: {
      const active = buffers.getActive();
      if (!active || !active.isEditable) {
        break;
      }

      state.interactionContext =
        state.interactionContext === "EDITOR" ? "SHELL" : "EDITOR";
      if (state.interactionContext === "EDITOR") {
        state.editorMode = "NORMAL";
        focusEditableBufferSurface(active);
      } else {
        blurEditableBufferSurface(active);
      }
      break;
    }

    case INTENTS.TOGGLE_URLLINE: {
      const nextVisible = !buffers.isUrllineVisible();
      buffers.setUrllineVisible(nextVisible);
      break;
    }

    case INTENTS.SET_URLLINE_VISIBILITY: {
      buffers.setUrllineVisible(Boolean(intent.enabled));
      break;
    }

    case INTENTS.HISTORY_SHOW:
      historyPanel.setTreeKind("history");
      historyPanel.show();
      historyPanel.focus();
      break;

    case INTENTS.HISTORY_HIDE:
      historyPanel.hide();
      break;

    case INTENTS.HISTORY_TOGGLE:
      historyPanel.toggle();
      break;

    case INTENTS.HISTORY_TOGGLE_FOCUS:
      historyPanel.toggleFocus();
      break;

    case INTENTS.HISTORY_DELETE_ALL:
      historyService.deleteAll();
      historyPanel.reloadData();
      historyPanel.render();
      break;

    case INTENTS.HISTORY_DELETE_TODAY:
      historyService.deleteToday();
      historyPanel.reloadData();
      historyPanel.render();
      break;

    case INTENTS.BOOKMARKS_SHOW:
      historyPanel.showTree("bookmarks");
      break;

    case INTENTS.BOOKMARKS_HIDE:
      historyPanel.hide();
      break;

    case INTENTS.BOOKMARKS_TOGGLE:
      if (historyPanel.isVisible() && historyPanel.treeKind === "bookmarks") {
        historyPanel.hide();
      } else {
        historyPanel.showTree("bookmarks");
      }
      break;

    case INTENTS.BOOKMARKS_TOGGLE_FOCUS:
      historyPanel.setTreeKind("bookmarks");
      historyPanel.toggleFocus();
      break;

    case INTENTS.BOOKMARKS_DELETE_ALL:
      bookmarksService.deleteAll();
      historyPanel.reloadData();
      historyPanel.render();
      break;

    case INTENTS.SESSION_SAVE: {
      const snapshot = buffers.exportSessionSnapshot();
      sessionService.writeSessionSnapshot(snapshot);
      console.info("Session snapshot saved to", sessionService.getSessionsFilePath());
      break;
    }

    case INTENTS.SESSION_RESTORE: {
      const snapshot = sessionService.readSessionSnapshot();
      const restored = buffers.restoreSessionSnapshot(snapshot);
      if (!restored) {
        console.warn("No restorable session snapshot found.");
      }
      break;
    }

    case INTENTS.QUIT:
      app.quit();
      break;

    case INTENTS.UNKNOWN_COMMAND:
      console.warn("Unknown command:", intent.raw);
      break;
  }

  const activeAfterDispatch = buffers.getActive();
  if (!activeAfterDispatch?.isEditable && state.interactionContext === "EDITOR") {
    state.interactionContext = "SHELL";
  }

  uiShell.updateStatuslineMode(computeStatuslineModeLabel(state));
  uiShell.setTablineOptions({
    dimActiveBuffer: historyPanel.isFocused(),
  });

  if (intent.next) {
    dispatch(win, intent.next, state);
  }
}

module.exports = { dispatch };

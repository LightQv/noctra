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
const bookmarkInsertScopeModal = require("./bookmarks/insertScopeModal");
const telescopeService = require("./telescope/service");
const { isBookmarkableBuffer } = require("./bookmarks/eligibility");
const sessionService = require("./session/service");
const { buildSettingsPageHtml } = require("./settings/page");
const notificationsStore = require("./notifications/store");
const notificationsService = require("./notifications/service");
const { validateNavigableUrl } = require("./security/urlPolicy");
const {
  resolveTheme,
  resolveThemeMode,
  resolveContentColorScheme,
  toCssVars,
} = require("../ui/theme");
const { resolveSemanticContext } = require("./semanticContextResolver");
const { enterCommandMode } = require("./modeTransitionService");
const editorSurface = require("./adapters/renderer/editorSurface");
const { broadcastUiShellPush } = require("./adapters/renderer/uiShellPush");
const webContentsActions = require("./adapters/platform/webContentsActions");
const { createNavigationHandlers } = require("./dispatcher/handlers/navigation");
const { createCommandUiHandlers } = require("./dispatcher/handlers/commandUi");
const { createBufferHandlers } = require("./dispatcher/handlers/buffers");
const { createConfigHandlers } = require("./dispatcher/handlers/config");
const { createEditorHandlers } = require("./dispatcher/handlers/editor");
const { createHistoryBookmarksHandlers } = require("./dispatcher/handlers/historyBookmarks");
const { createTelescopeHandlers } = require("./dispatcher/handlers/telescope");
const { createSessionHandlers } = require("./dispatcher/handlers/session");
const { createMiscHandlers } = require("./dispatcher/handlers/misc");

function computeStatuslineModeLabel(state) {
  if (telescopeService.isActive()) {
    return telescopeService.getMode();
  }

  if (state.mode === "COMMAND") {
    return "COMMAND";
  }

  if (historyPanel.isVisible() && historyPanel.isFocused()) {
    return "TREE:NORMAL";
  }

  const active = buffers.getActive();
  if (!active || !active.isEditable) {
    return state.mode;
  }

  if (resolveSemanticContext({ state, buffers, historyPanel }) === "editor") {
    return `EDITOR:${state.editorMode || "NORMAL"}`;
  }

  return `SHELL:${state.mode}`;
}

function blurFocusedWebInput(buffer) {
  if (!buffer || buffer.isEditable || !buffer.webContents || buffer.webContents.isDestroyed()) {
    return;
  }

  webContentsActions
    .executeScript(
      buffer.webContents,
      `(function blurFocusedEditable() {
        const element = document.activeElement;
        if (!element || !(element instanceof Element)) return false;
        const isEditable =
          (typeof element.matches === "function" &&
            element.matches("input, textarea, select, [contenteditable]")) ||
          element.isContentEditable === true;
        if (!isEditable || typeof element.blur !== "function") return false;
        element.blur();
        return true;
      })();`,
      true,
    )
    .catch(() => {});
}

function openSettingsBuffer() {
  return openEditableFileBuffer({
    virtualUrl: "noctra://settings/config.yml",
    title: "config.yml",
    filePath: configService.getConfigPath(),
    viewTitle: "Settings",
  });
}

function openNotificationsBuffer() {
  return openEditableFileBuffer({
    virtualUrl: "noctra://settings/notifications.yml",
    title: "notifications.yml",
    filePath: notificationsStore.ensureNotificationsFile(),
    viewTitle: "Notifications",
  });
}

function openEditableFileBuffer(options = {}) {
  const existing = buffers.findByKind("editable");
  const filePath = String(options.filePath || "");
  const virtualUrl = String(options.virtualUrl || "about:blank");
  const title = String(options.title || "[No title]");
  const viewTitle = String(options.viewTitle || "Settings");

  if (existing) {
    existing.editableFilePath = filePath;
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
    initialContent = fs.readFileSync(filePath, "utf8");
  } catch {
    initialContent = "";
  }
  const html = buildSettingsPageHtml(
    filePath,
    { theme, colorScheme: resolvedMode },
    initialContent,
    { viewTitle },
  );

  const buffer = buffers.create(null, {
    kind: "editable",
    activate: true,
    preloadPath: path.join(__dirname, "..", "ui", "shell", "preload.js"),
  });

  buffer.loadVirtualDocument({
    url: virtualUrl,
    title,
    html,
  });
  buffer.editableFilePath = filePath;

  return buffer;
}

function getUrlPolicyConfig() {
  return {
    allowHttpLoopback: configService.getConfigValue("browser.allow_http_loopback", true),
    allowHttpPrivateLan: configService.getConfigValue("browser.allow_http_private_lan", true),
    trustedHttpHosts: configService.getConfigValue("browser.trusted_http_hosts", []),
  };
}

function normalizeUrl(rawUrl) {
  const value = typeof rawUrl === "string" ? rawUrl.trim() : "";
  if (!value) return null;
  const validation = validateNavigableUrl(value, getUrlPolicyConfig());
  if (!validation.ok) return null;
  return validation.url;
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
  broadcastUiShellPush({ win, buffers, type: "theme:update", payload });
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

function getActiveBookmarkCandidate() {
  const active = buffers.getActive();
  if (!isBookmarkableBuffer(active)) return null;
  const url = typeof active.url === "string" ? active.url.trim() : "";
  const title = String(active.title || url).trim() || url;
  return { title, url };
}

function createIntentHandlers(dispatch) {
  const deps = {
    app,
    buffers,
    uiShell,
    configService,
    buildSearchUrl,
    historyService,
    historyPanel,
    bookmarksService,
    bookmarkInsertScopeModal,
    telescopeService,
    sessionService,
    notificationsService,
    enterCommandMode,
    dispatch,
    focusEditableBufferSurface: editorSurface.focus,
    blurEditableBufferSurface: editorSurface.blur,
    runEditableExCommand: editorSurface.runCommand,
    blurFocusedWebInput,
    openSettingsBuffer,
    openNotificationsBuffer,
    normalizeUrl,
    applyThemeEverywhere,
    reloadReloadableBuffers,
    getActiveBookmarkCandidate,
    webContentsActions,
  };

  return {
    ...createNavigationHandlers(deps),
    ...createCommandUiHandlers(deps),
    ...createBufferHandlers(deps),
    ...createConfigHandlers(deps),
    ...createEditorHandlers(deps),
    ...createHistoryBookmarksHandlers(deps),
    ...createTelescopeHandlers(deps),
    ...createSessionHandlers(deps),
    ...createMiscHandlers(deps),
  };
}

let intentHandlers = null;

function warnOnIntentCoverageGaps(handlers) {
  const missing = Object.values(INTENTS).filter((type) => typeof handlers[type] !== "function");
  if (!missing.length) {
    return;
  }

  console.warn(
    `[dispatcher] Missing handler(s) for known intent types: ${missing.join(", ")}`,
  );
}

function dispatch(win, intent, state) {
  if (!intent) return;

  if (!isKnownIntentType(intent.type)) {
    notificationsService.notify({
      severity: "warning",
      code: "unknown_intent_type",
      message: `Unknown intent type: ${String(intent.type || "")}`,
      source: "core.dispatcher",
      context: { intent },
      persist: false,
    });
    return;
  }

  const buf = buffers.getActive();
  if (!buf) return;

  if (!intentHandlers) {
    intentHandlers = createIntentHandlers(dispatch);
    warnOnIntentCoverageGaps(intentHandlers);
  }

  const handler = intentHandlers[intent.type];
  if (typeof handler === "function") {
    handler({ win, intent, state });
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

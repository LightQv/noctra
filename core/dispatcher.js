const { app, nativeTheme, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const buffers = require("../browser/manager");
const uiShell = require("../ui/shell/manager");
const configService = require("./config/service");
const { INTENTS, isKnownIntentType } = require("./intents");
const { buildSearchUrl } = require("./resolver");
const historyService = require("./history/service");
const sidepanelController = require("./sidepanel/controller");
const bookmarksService = require("./bookmarks/service");
const bookmarkInsertScopeModal = require("./bookmarks/insertScopeModal");
const telescopeService = require("./telescope/service");
const { isBookmarkableBuffer } = require("./bookmarks/eligibility");
const sessionService = require("./session/service");
const { buildSettingsPageHtml } = require("./settings/page");
const notificationsStore = require("./notifications/store");
const notificationsService = require("./notifications/service");
const { validateNavigableUrl } = require("./security/urlPolicy");
const { SURFACE_ROLES } = require("./security/surfaceTrust");
const {
  resolveTheme,
  resolveThemeMode,
  resolveContentColorScheme,
  normalizeThemeMode,
  normalizeCustomBase,
  toCssVars,
} = require("../ui/theme");
const { enterCommandMode } = require("./modeTransitionService");
const { setEditorFocused, isEditorFocused } = require("./editorFocusState");
const { computeStatuslineModeLabel } = require("./statuslineModeLabel");
const { assertIntentShape, enforceInvariant } = require("./invariants");
const { validateIntentPayload } = require("./contracts/intents");
const {
  createInvalidPayloadError,
  createUnknownIntentError,
} = require("./contracts/errors");
const editorSurface = require("./adapters/renderer/editorSurface");
const { broadcastUiShellPush } = require("./adapters/renderer/uiShellPush");
const webContentsActions = require("./adapters/platform/webContentsActions");
const {
  createNavigationHandlers,
} = require("./dispatcher/handlers/navigation");
const { createCommandUiHandlers } = require("./dispatcher/handlers/commandUi");
const { createBufferHandlers } = require("./dispatcher/handlers/buffers");
const { createConfigHandlers } = require("./dispatcher/handlers/config");
const { createEditorHandlers } = require("./dispatcher/handlers/editor");
const {
  createHistoryBookmarksHandlers,
} = require("./dispatcher/handlers/historyBookmarks");
const { createTelescopeHandlers } = require("./dispatcher/handlers/telescope");
const { createSessionHandlers } = require("./dispatcher/handlers/session");
const { createMiscHandlers } = require("./dispatcher/handlers/misc");
const { createSearchHandlers } = require("./dispatcher/handlers/search");

function blurFocusedWebInput(buffer) {
  if (
    !buffer ||
    buffer.isEditable ||
    !buffer.webContents ||
    buffer.webContents.isDestroyed()
  ) {
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

function openSettingsBuffer(buffersRef = buffers) {
  return openEditableFileBuffer({
    virtualUrl: "noctra://settings/config.yml",
    title: "config.yml",
    filePath: configService.getConfigPath(),
    viewTitle: "Settings",
  }, buffersRef);
}

function openNotificationsBuffer(buffersRef = buffers) {
  return openEditableFileBuffer({
    virtualUrl: "noctra://settings/notifications.yml",
    title: "notifications.yml",
    filePath: notificationsStore.ensureNotificationsFile(),
    viewTitle: "Notifications",
  }, buffersRef);
}

function openEditableFileBuffer(options = {}, buffersRef = buffers) {
  const existing = buffersRef.findByKind("editable");
  const filePath = String(options.filePath || "");
  const virtualUrl = String(options.virtualUrl || "about:blank");
  const title = String(options.title || "[No title]");
  const viewTitle = String(options.viewTitle || "Settings");

  if (existing) {
    existing.editableFilePath = filePath;
    buffersRef.switchTo(existing.id);
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

  const buffer = buffersRef.create(null, {
    kind: "editable",
    activate: true,
    preloadPath: path.join(__dirname, "..", "ui", "settings", "preload.js"),
    surfaceRole: SURFACE_ROLES.TRUSTED_SETTINGS,
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
    allowHttpLoopback: configService.getConfigValue(
      "browser.allow_http_loopback",
      true,
    ),
    allowHttpPrivateLan: configService.getConfigValue(
      "browser.allow_http_private_lan",
      true,
    ),
    trustedHttpHosts: configService.getConfigValue(
      "browser.trusted_http_hosts",
      [],
    ),
  };
}

function normalizeUrl(rawUrl) {
  const value = typeof rawUrl === "string" ? rawUrl.trim() : "";
  if (!value) return null;
  const validation = validateNavigableUrl(value, getUrlPolicyConfig());
  if (!validation.ok) return null;
  return validation.url;
}

function resolveCurrentThemeContext(runtimeDeps = {}) {
  const localConfigService = runtimeDeps.configService || configService;
  const localNativeTheme = runtimeDeps.nativeTheme || nativeTheme;
  const themeConfig = localConfigService.getConfigValue("global.theme", {});
  const configuredMode = normalizeThemeMode(
    typeof themeConfig?.mode === "string" ? themeConfig.mode : themeConfig?.name,
    "dark",
  );
  const resolvedMode = resolveThemeMode(themeConfig, {
    systemPrefersDark: localNativeTheme.shouldUseDarkColors,
  });
  const theme = resolveTheme(themeConfig, {
    systemPrefersDark: localNativeTheme.shouldUseDarkColors,
  });
  const contentColorScheme = resolveContentColorScheme(themeConfig, {
    systemPrefersDark: localNativeTheme.shouldUseDarkColors,
  });
  const customBase = normalizeCustomBase(themeConfig?.custom_base, "dark");

  return {
    theme,
    configuredMode,
    resolvedMode,
    contentColorScheme,
    customBase,
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

function applyThemeEverywhere(win, runtimeDeps = {}) {
  const localNativeTheme = runtimeDeps.nativeTheme || nativeTheme;
  const localUiShell = runtimeDeps.uiShell || uiShell;
  const localSidepanelController =
    runtimeDeps.sidepanelController || sidepanelController;
  const localBuffers = runtimeDeps.buffers || buffers;

  const themeContext = resolveCurrentThemeContext(runtimeDeps);
  const payload = buildThemePayload(themeContext);
  const uiFollowsSystem =
    themeContext.configuredMode === "auto" ||
    (themeContext.configuredMode === "custom" &&
      themeContext.customBase === "auto");
  localNativeTheme.themeSource = uiFollowsSystem ? "system" : payload.resolvedMode;
  localUiShell.setTheme(payload.theme);
  localSidepanelController.setThemeVars(payload.themeVars);
  localBuffers.setContentUiOptions({
    thumbColor: payload.theme.scrollbarThumbColor,
    thumbActiveColor: payload.theme.scrollbarThumbActiveColor,
    contentColorScheme:
      themeContext.contentColorScheme === "light" ? "light" : "dark",
  });
  localBuffers.refreshDashboardBuffers();
  localBuffers.refreshCatBuffers();
  broadcastUiShellPush({
    win,
    buffers: localBuffers,
    type: "theme:update",
    payload,
  });
}

function isReloadableWebBuffer(buffer) {
  if (
    !buffer ||
    buffer.isEditable ||
    !buffer.webContents ||
    buffer.webContents.isDestroyed()
  ) {
    return false;
  }

  const url = typeof buffer.url === "string" ? buffer.url.trim() : "";
  return url.startsWith("http://") || url.startsWith("https://");
}

function reloadReloadableBuffers(runtimeDeps = {}) {
  const localBuffers = runtimeDeps.buffers || buffers;
  for (const buffer of localBuffers.getBuffers()) {
    if (!isReloadableWebBuffer(buffer)) {
      continue;
    }
    buffer.webContents.reload();
  }
}

function quitCurrentWindowOrApp(win) {
  const windows =
    BrowserWindow && typeof BrowserWindow.getAllWindows === "function"
      ? BrowserWindow.getAllWindows().filter(
          (windowRef) => windowRef && !windowRef.isDestroyed(),
        )
      : [];

  if (windows.length <= 1) {
    app.quit();
    return;
  }

  if (win && !win.isDestroyed()) {
    win.close();
    return;
  }

  const focused = windows.find((windowRef) => windowRef.isFocused());
  if (focused) {
    focused.close();
    return;
  }

  windows[windows.length - 1].close();
}

function getActiveBookmarkCandidate(buffersRef) {
  const active = buffersRef.getActive();
  if (!isBookmarkableBuffer(active)) return null;
  const url = typeof active.url === "string" ? active.url.trim() : "";
  const title = String(active.title || url).trim() || url;
  return { title, url };
}

function createIntentHandlers(dispatch, runtimeDeps = {}) {
  const {
    app: localApp = app,
    buffers: localBuffers = buffers,
    uiShell: localUiShell = uiShell,
    configService: localConfigService = configService,
    historyService: localHistoryService = historyService,
    sidepanelController: localSidepanelController = sidepanelController,
    bookmarksService: localBookmarksService = bookmarksService,
    bookmarkInsertScopeModal: localBookmarkInsertScopeModal = bookmarkInsertScopeModal,
    telescopeService: localTelescopeService = telescopeService,
    sessionService: localSessionService = sessionService,
    notificationsService: localNotificationsService = notificationsService,
  } = runtimeDeps;

  const deps = {
    app: localApp,
    buffers: localBuffers,
    uiShell: localUiShell,
    configService: localConfigService,
    buildSearchUrl,
    historyService: localHistoryService,
    sidepanelController: localSidepanelController,
    bookmarksService: localBookmarksService,
    bookmarkInsertScopeModal: localBookmarkInsertScopeModal,
    telescopeService: localTelescopeService,
    sessionService: localSessionService,
    notificationsService: localNotificationsService,
    enterCommandMode,
    dispatch,
    focusEditableBufferSurface: editorSurface.focus,
    blurEditableBufferSurface: editorSurface.blur,
    runEditableExCommand: editorSurface.runCommand,
    blurFocusedWebInput,
    openSettingsBuffer: () => openSettingsBuffer(localBuffers),
    openNotificationsBuffer: () => openNotificationsBuffer(localBuffers),
    normalizeUrl,
    applyThemeEverywhere: (win) => applyThemeEverywhere(win, runtimeDeps),
    applyThemeAcrossWindows: runtimeDeps.applyThemeAcrossWindows,
    reloadReloadableBuffers: () => reloadReloadableBuffers(runtimeDeps),
    quitCurrentWindowOrApp,
    getActiveBookmarkCandidate: () => getActiveBookmarkCandidate(localBuffers),
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
    ...createSearchHandlers(deps),
  };
}

function createDispatcher(runtimeDeps = {}) {
  const localBuffers = runtimeDeps.buffers || buffers;
  const localUiShell = runtimeDeps.uiShell || uiShell;
  const localSidepanelController =
    runtimeDeps.sidepanelController || sidepanelController;
  const localNotificationsService =
    runtimeDeps.notificationsService || notificationsService;

  let intentHandlers = null;

  function dispatch(win, intent, state) {
    if (!intent) return;
    assertIntentShape(intent);

    if (!isKnownIntentType(intent.type)) {
      const error = createUnknownIntentError(intent.type, { intent });
      localNotificationsService.notify({
        severity: "warning",
        code: error.code,
        message: error.message,
        source: "core.dispatcher",
        context: error,
        persist: false,
      });
      return;
    }

    const validation = validateIntentPayload(intent.type, intent);
    if (!validation.ok) {
      const error = createInvalidPayloadError("dispatcher", intent.type, {
        validationMessage: validation.message,
        validationDetails: validation.details || {},
        intent,
      });
      localNotificationsService.notify({
        severity: "warning",
        code: error.code,
        message: error.message,
        source: "core.dispatcher",
        context: error,
        persist: false,
      });
      return;
    }

    const buf = localBuffers.getActive();
    if (!buf) return;

    if (!intentHandlers) {
      intentHandlers = createIntentHandlers(dispatch, runtimeDeps);
      const missing = Object.values(INTENTS).filter(
        (type) => typeof intentHandlers[type] !== "function",
      );
      enforceInvariant(
        missing.length === 0,
        "missing dispatcher handlers for known intent types",
        { missing },
      );
    }

    const handler = intentHandlers[intent.type];
    if (typeof handler === "function") {
      handler({ win, intent, state });
    }

    const activeAfterDispatch = localBuffers.getActive();
    if (!activeAfterDispatch?.isEditable && isEditorFocused(state)) {
      setEditorFocused(state, false);
    }

    localUiShell.updateStatuslineMode(computeStatuslineModeLabel(state));
    localUiShell.updateStatuslineSearchCount({
      mode: state.mode,
      active: state.searchActive,
      index: state.searchMatchIndex,
      total: state.searchMatchTotal,
    });
    localUiShell.setTablineOptions({
      dimActiveBuffer: localSidepanelController.isFocused(),
    });

    if (intent.next) {
      dispatch(win, intent.next, state);
    }
  }

  return dispatch;
}

const dispatch = createDispatcher();

module.exports = { dispatch, createDispatcher };

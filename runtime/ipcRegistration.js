const { setEditorMode } = require("../core/state/editorModeState");
const { validateIpcPayload } = require("../core/contracts/ipc");
const { createInvalidPayloadError } = require("../core/contracts/errors");
const {
  buildUIShellContextMenuTemplate,
} = require("../core/adapters/platform/contextMenuBuilder");
const {
  createUIShellContextMenuActions,
} = require("../core/adapters/platform/contextMenuActions");

function registerRuntimeIpc({
  win,
  fs,
  ipcMain,
  state,
  buffers,
  dispatch,
  INTENTS,
  uiShell,
  sidepanelController,
  webContentsActions,
  getSurfaceRole,
  isAllowedTrustedSurfaceUrl,
  SURFACE_ROLES,
  performWindowAction,
  setEditorFocused,
  enterCommandMode,
  focusActiveEditorSurface,
  getStatuslineModeLabel,
  startUrllineEdit,
  stopUrllineEdit,
  configService,
  resolveCurrentTheme,
  buildThemePayload,
  applyReloadedConfig,
  registerIpcContracts,
  notificationsService,
  clipboard,
}) {
  const isTrustedIpcSender = (
    event,
    expectedRole,
    { requireActiveBuffer = false } = {},
  ) => {
    if (!win || !event || !event.sender) {
      return false;
    }

    if (
      expectedRole === SURFACE_ROLES.TRUSTED_SHELL &&
      event.sender !== win.webContents
    ) {
      return false;
    }

    if (
      expectedRole === SURFACE_ROLES.TRUSTED_SETTINGS &&
      !buffers.isEditableWebContents(event.sender)
    ) {
      return false;
    }

    if (
      requireActiveBuffer &&
      event.sender !== buffers.getActiveWebContents()
    ) {
      return false;
    }

    if (getSurfaceRole(event.sender) !== expectedRole) {
      return false;
    }

    const senderFrameUrl =
      event.senderFrame && typeof event.senderFrame.url === "string"
        ? event.senderFrame.url
        : "";
    return isAllowedTrustedSurfaceUrl(senderFrameUrl);
  };

  const isWindowSender = (event) =>
    isTrustedIpcSender(event, SURFACE_ROLES.TRUSTED_SHELL);
  const isEditableSender = (event, options = {}) =>
    isTrustedIpcSender(event, SURFACE_ROLES.TRUSTED_SETTINGS, options);

  const reportContractWarning = (error) => {
    if (
      !notificationsService ||
      typeof notificationsService.notify !== "function"
    ) {
      return;
    }
    notificationsService.notify({
      severity: "warning",
      code: error.code,
      message: error.message,
      source: "runtime.ipc",
      context: error,
      persist: false,
    });
  };

  const rejectEvent = (channel, error) => {
    reportContractWarning(error);
    return;
  };

  const rejectInvoke = (error) => {
    reportContractWarning(error);
    return { ok: false, error };
  };

  const withEventBoundary = (channel, expectedRole, handler, options = {}) => {
    return (event, payload) => {
      const trusted =
        expectedRole === SURFACE_ROLES.TRUSTED_SETTINGS
          ? isEditableSender(event, options)
          : isWindowSender(event);
      if (!win || !trusted) {
        return;
      }

      const validation = validateIpcPayload(channel, payload);
      if (!validation.ok) {
        const error = createInvalidPayloadError("ipc:event", channel, {
          validationMessage: validation.message,
          validationDetails: validation.details || {},
        });
        return rejectEvent(channel, error);
      }

      return handler(event, payload);
    };
  };

  const withInvokeBoundary = (channel, expectedRole, handler, options = {}) => {
    return async (event, payload) => {
      const trusted =
        expectedRole === SURFACE_ROLES.TRUSTED_SETTINGS
          ? isEditableSender(event, options)
          : isWindowSender(event);
      if (!win || !trusted) {
        return undefined;
      }

      const validation = validateIpcPayload(channel, payload);
      if (!validation.ok) {
        const error = createInvalidPayloadError("ipc:invoke", channel, {
          validationMessage: validation.message,
          validationDetails: validation.details || {},
        });
        return rejectInvoke(error);
      }

      return handler(event, payload);
    };
  };

  const onWindowAction = (event, payload) => {
    const action = payload.action;
    performWindowAction(win, action);
  };

  const onOpenSettings = (_event) => {
    dispatch(win, { type: INTENTS.OPEN_SETTINGS_BUFFER }, state);
  };

  const onNewTab = (_event) => {
    dispatch(win, { type: INTENTS.NEW_BUFFER }, state);
  };

  const onOpenHistory = (_event) => {
    dispatch(win, { type: INTENTS.HISTORY_SHOW }, state);
    uiShell.updateStatuslineMode(getStatuslineModeLabel());
  };

  const onOpenDownloads = (_event) => {
    dispatch(win, { type: INTENTS.DOWNLOADS_LIVE_MODAL }, state);
    uiShell.updateStatuslineMode(getStatuslineModeLabel());
  };

  const onTabActivate = (event, payload) => {
    const bufferId = payload.id;
    buffers.switchTo(bufferId);
    sidepanelController.unfocus();
    buffers.focusActive();
    uiShell.updateStatuslineMode(getStatuslineModeLabel());
  };

  const onTabClose = (event, payload) => {
    const bufferId = payload.id;
    buffers.close(bufferId);
  };

  const onUrllineStartEdit = (event, payload) => {
    const pane = payload.pane === "right" ? "right" : "left";
    buffers.focusPane(pane);
    const paneBuffer = buffers.getPaneBuffer(pane);
    if (!paneBuffer || paneBuffer.isEditable) {
      return;
    }
    startUrllineEdit(pane, paneBuffer.url || "about:blank");
  };

  const onStopUrllineEdit = () => {
    stopUrllineEdit();
  };

  const onUrllineAction = (event, payload) => {
    const pane = payload.pane === "right" ? "right" : "left";
    const action = payload.action;
    const paneBuffer = buffers.getPaneBuffer(pane);
    if (!paneBuffer || paneBuffer.isEditable) {
      return;
    }

    buffers.focusPane(pane);

    if (action === "back") {
      webContentsActions.goBack(paneBuffer.webContents);
      return;
    }

    if (action === "forward") {
      webContentsActions.goForward(paneBuffer.webContents);
      return;
    }

    if (action === "reload") {
      webContentsActions.reload(paneBuffer.webContents);
      return;
    }

    if (action === "stop") {
      webContentsActions.stop(paneBuffer.webContents);
    }
  };

  const onContextMenu = (_event, payload) => {
    const { zone, target, tabId, pane } = payload;

    const uiActions = createUIShellContextMenuActions({
      clipboard,
      buffers,
      dispatch,
      state,
      INTENTS,
      startUrllineEdit,
      win,
    });

    let template = [];

    if (zone === "tabline" && target === "tab" && Number.isInteger(tabId)) {
      const index = buffers.buffers.findIndex(
        (buffer) => buffer.id === tabId,
      );
      const tabBuffer = index >= 0 ? buffers.buffers[index] : null;
      const runtimeSnapshot = {
        tabIndex: index,
        isFirst: index === 0,
        isLast:
          index >= 0 && index === buffers.buffers.length - 1,
        isSplitEnabled:
          buffers.isSplitEnabled() && buffers.split.mode === "regular",
        buffer: tabBuffer,
      };
      const actions = uiActions.forTablineTab(tabId);
      template = buildUIShellContextMenuTemplate({
        zone,
        target,
        runtimeSnapshot,
        actions,
      });
    }

    if (zone === "tabline" && target === "background") {
      const actions = uiActions.forTablineBackground();
      const runtimeSnapshot = {
        canReopenClosedBuffer: Boolean(
          buffers.closedBuffers && buffers.closedBuffers.length > 0,
        ),
      };
      template = buildUIShellContextMenuTemplate({
        zone,
        target,
        runtimeSnapshot,
        actions,
      });
    }

    if (zone === "urlline") {
      const paneName = pane === "right" ? "right" : "left";
      const actions = uiActions.forUrllineUrl(paneName);
      template = buildUIShellContextMenuTemplate({
        zone,
        target,
        runtimeSnapshot: {},
        actions,
      });
    }

    if (template.length > 0) {
      if (uiShell && typeof uiShell.showContextMenu === "function") {
        uiShell.showContextMenu(template, payload.x, payload.y);
      }
    }
  };

  const onEditorToggleContext = (_event) => {
    dispatch(win, { type: INTENTS.TOGGLE_FOCUS_CONTEXT }, state);
    uiShell.updateStatuslineMode(getStatuslineModeLabel());
  };

  const onEditorModeChange = (event, payload) => {
    const nextMode =
      payload.mode === "INSERT" || payload.mode === "NORMAL"
        ? payload.mode
        : "NORMAL";
    setEditorMode(state, nextMode);
    uiShell.updateStatuslineMode(getStatuslineModeLabel());
  };

  const onEditorFocusRequest = (_event) => {
    setEditorFocused(state, true);
    focusActiveEditorSurface();
    uiShell.updateStatuslineMode(getStatuslineModeLabel());
  };

  const onEditorOpenCommand = (event, payload) => {
    const initialText =
      typeof payload.initialText === "string" ? payload.initialText : "";
    enterCommandMode(state, {
      target: "EDITOR",
      initialText,
      reason: "editor-open-command",
    });
    dispatch(win, { type: INTENTS.SHOW_COMMAND }, state);
    dispatch(win, { type: INTENTS.COMMAND_INPUT }, state);
  };

  const onEditorOpenSearch = (_event) => {
    dispatch(win, { type: INTENTS.SEARCH_OPEN_PROMPT }, state);
  };

  const onEditorReady = (_event) => {
    setEditorFocused(state, true);
    setEditorMode(state, "NORMAL");
    focusActiveEditorSurface({ forceNormal: true });
    uiShell.updateStatuslineMode(getStatuslineModeLabel());
  };

  const onSettingsGet = async (_event) => {
    const activeBuffer = buffers.getActive();
    const configPath =
      activeBuffer &&
      activeBuffer.isEditable &&
      typeof activeBuffer.editableFilePath === "string"
        ? activeBuffer.editableFilePath
        : configService.getConfigPath();
    try {
      const content = fs.readFileSync(configPath, "utf8");
      const themeContext = resolveCurrentTheme();
      return {
        ok: true,
        content,
        leaderKey: configService.getConfigValue(
          "global.input.leader_key",
          "Space",
        ),
        relativeLineNumbers: configService.getConfigValue(
          "global.editor.relative_line_numbers",
          true,
        ),
        scrolloffLines: configService.getConfigValue(
          "global.editor.scrolloff_lines",
          3,
        ),
        ...buildThemePayload(themeContext),
      };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const onSettingsSave = async (event, payload) => {
    const activeBuffer = buffers.getActive();
    const configPath =
      activeBuffer &&
      activeBuffer.isEditable &&
      typeof activeBuffer.editableFilePath === "string"
        ? activeBuffer.editableFilePath
        : configService.getConfigPath();
    try {
      fs.writeFileSync(configPath, String(payload?.content || ""), "utf8");
      if (configPath !== configService.getConfigPath()) {
        return { ok: true };
      }
      const config = configService.reloadConfig();
      applyReloadedConfig(config, { refreshLayout: true });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const onSettingsClose = async (_event) => {
    dispatch(win, { type: INTENTS.CLOSE_BUFFER }, state);
    return { ok: true };
  };

  const onSecurityProbePrivilegedIpc = async (event) => {
    if (process.env.NOCTRA_SMOKE_TEST !== "1") {
      return { ok: false, reason: "disabled" };
    }
    if (!isWindowSender(event)) {
      return { ok: false, reason: "unauthorized_probe_sender" };
    }

    const untrustedSender = buffers.getActiveWebContents();
    if (!untrustedSender) {
      return { ok: false, reason: "no_active_sender" };
    }

    const fakeEvent = {
      sender: untrustedSender,
      senderFrame: { url: "https://evil.invalid" },
    };

    const getResult = await onSettingsGet(fakeEvent);
    const saveResult = await onSettingsSave(fakeEvent, { content: "probe" });
    const closeResult = await onSettingsClose(fakeEvent);
    return {
      ok: true,
      rejected: {
        settingsGet: !getResult || getResult.ok !== true,
        settingsSave: !saveResult || saveResult.ok !== true,
        settingsClose: !closeResult || closeResult.ok !== true,
      },
    };
  };

  const ipcEvents = {
    "ui-shell:window-action": withEventBoundary(
      "ui-shell:window-action",
      SURFACE_ROLES.TRUSTED_SHELL,
      onWindowAction,
    ),
    "ui-shell:open-settings": withEventBoundary(
      "ui-shell:open-settings",
      SURFACE_ROLES.TRUSTED_SHELL,
      onOpenSettings,
    ),
    "ui-shell:new-tab": withEventBoundary(
      "ui-shell:new-tab",
      SURFACE_ROLES.TRUSTED_SHELL,
      onNewTab,
    ),
    "ui-shell:open-history": withEventBoundary(
      "ui-shell:open-history",
      SURFACE_ROLES.TRUSTED_SHELL,
      onOpenHistory,
    ),
    "ui-shell:open-downloads": withEventBoundary(
      "ui-shell:open-downloads",
      SURFACE_ROLES.TRUSTED_SHELL,
      onOpenDownloads,
    ),
    "ui-shell:tab-activate": withEventBoundary(
      "ui-shell:tab-activate",
      SURFACE_ROLES.TRUSTED_SHELL,
      onTabActivate,
    ),
    "ui-shell:tab-close": withEventBoundary(
      "ui-shell:tab-close",
      SURFACE_ROLES.TRUSTED_SHELL,
      onTabClose,
    ),
    "ui-shell:urlline-start-edit": withEventBoundary(
      "ui-shell:urlline-start-edit",
      SURFACE_ROLES.TRUSTED_SHELL,
      onUrllineStartEdit,
    ),
    "ui-shell:urlline-action": withEventBoundary(
      "ui-shell:urlline-action",
      SURFACE_ROLES.TRUSTED_SHELL,
      onUrllineAction,
    ),
    "ui-shell:stop-urlline-edit": withEventBoundary(
      "ui-shell:stop-urlline-edit",
      SURFACE_ROLES.TRUSTED_SHELL,
      onStopUrllineEdit,
    ),
    "ui-shell:context-menu": withEventBoundary(
      "ui-shell:context-menu",
      SURFACE_ROLES.TRUSTED_SHELL,
      onContextMenu,
    ),
    "settings:editor-toggle-context": withEventBoundary(
      "settings:editor-toggle-context",
      SURFACE_ROLES.TRUSTED_SETTINGS,
      onEditorToggleContext,
    ),
    "settings:editor-mode-change": withEventBoundary(
      "settings:editor-mode-change",
      SURFACE_ROLES.TRUSTED_SETTINGS,
      onEditorModeChange,
    ),
    "settings:editor-focus-request": withEventBoundary(
      "settings:editor-focus-request",
      SURFACE_ROLES.TRUSTED_SETTINGS,
      onEditorFocusRequest,
    ),
    "settings:editor-open-command": withEventBoundary(
      "settings:editor-open-command",
      SURFACE_ROLES.TRUSTED_SETTINGS,
      onEditorOpenCommand,
    ),
    "settings:editor-open-search": withEventBoundary(
      "settings:editor-open-search",
      SURFACE_ROLES.TRUSTED_SETTINGS,
      onEditorOpenSearch,
    ),
    "settings:editor-ready": withEventBoundary(
      "settings:editor-ready",
      SURFACE_ROLES.TRUSTED_SETTINGS,
      onEditorReady,
    ),
  };

  const ipcHandlers = {
    "settings:get": withInvokeBoundary(
      "settings:get",
      SURFACE_ROLES.TRUSTED_SETTINGS,
      onSettingsGet,
      { requireActiveBuffer: true },
    ),
    "settings:save": withInvokeBoundary(
      "settings:save",
      SURFACE_ROLES.TRUSTED_SETTINGS,
      onSettingsSave,
      { requireActiveBuffer: true },
    ),
    "settings:close": withInvokeBoundary(
      "settings:close",
      SURFACE_ROLES.TRUSTED_SETTINGS,
      onSettingsClose,
      { requireActiveBuffer: true },
    ),
  };

  if (process.env.NOCTRA_SMOKE_TEST === "1") {
    ipcHandlers["security:probe-privileged-ipc"] = withInvokeBoundary(
      "security:probe-privileged-ipc",
      SURFACE_ROLES.TRUSTED_SHELL,
      onSecurityProbePrivilegedIpc,
    );
  }

  const unregisterIpc = registerIpcContracts({
    ipcMain,
    events: ipcEvents,
    handlers: ipcHandlers,
  });

  win.on("closed", () => {
    unregisterIpc();
  });
}

module.exports = {
  registerRuntimeIpc,
};

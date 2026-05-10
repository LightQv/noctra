const { setEditorMode } = require("../core/state/editorModeState");

function registerRuntimeIpc({
  win,
  fs,
  ipcMain,
  state,
  buffers,
  dispatch,
  INTENTS,
  uiShell,
  historyPanel,
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
  configService,
  resolveCurrentTheme,
  buildThemePayload,
  applyReloadedConfig,
  registerIpcContracts,
}) {
  const isTrustedIpcSender = (event, expectedRole, { requireActiveBuffer = false } = {}) => {
    if (!win || !event || !event.sender) {
      return false;
    }

    if (expectedRole === SURFACE_ROLES.TRUSTED_SHELL && event.sender !== win.webContents) {
      return false;
    }

    if (expectedRole === SURFACE_ROLES.TRUSTED_SETTINGS && !buffers.isEditableWebContents(event.sender)) {
      return false;
    }

    if (requireActiveBuffer && event.sender !== buffers.getActiveWebContents()) {
      return false;
    }

    if (getSurfaceRole(event.sender) !== expectedRole) {
      return false;
    }

    const senderFrameUrl =
      event.senderFrame && typeof event.senderFrame.url === "string" ? event.senderFrame.url : "";
    return isAllowedTrustedSurfaceUrl(senderFrameUrl);
  };

  const isWindowSender = (event) => isTrustedIpcSender(event, SURFACE_ROLES.TRUSTED_SHELL);
  const isEditableSender = (event, options = {}) =>
    isTrustedIpcSender(event, SURFACE_ROLES.TRUSTED_SETTINGS, options);

  const onWindowAction = (event, payload) => {
    if (!win || !isWindowSender(event) || !payload || typeof payload !== "object") return;
    const action = payload.action;
    performWindowAction(win, action);
  };

  const onOpenSettings = (event) => {
    if (!win || !isWindowSender(event)) return;
    dispatch(win, { type: INTENTS.OPEN_SETTINGS_BUFFER }, state);
  };

  const onNewTab = (event) => {
    if (!win || !isWindowSender(event)) return;
    dispatch(win, { type: INTENTS.NEW_BUFFER }, state);
  };

  const onOpenHistory = (event) => {
    if (!win || !isWindowSender(event)) return;
    dispatch(win, { type: INTENTS.HISTORY_SHOW }, state);
    uiShell.updateStatuslineMode(getStatuslineModeLabel());
  };

  const onTabActivate = (event, payload) => {
    if (!win || !isWindowSender(event) || !payload || typeof payload !== "object") return;
    const bufferId = Number.parseInt(payload.id, 10);
    if (!Number.isInteger(bufferId)) return;
    buffers.switchTo(bufferId);
    historyPanel.unfocus();
    buffers.focusActive();
    uiShell.updateStatuslineMode(getStatuslineModeLabel());
  };

  const onTabClose = (event, payload) => {
    if (!win || !isWindowSender(event) || !payload || typeof payload !== "object") return;
    const bufferId = Number.parseInt(payload.id, 10);
    if (!Number.isInteger(bufferId)) return;
    buffers.close(bufferId);
  };

  const onUrllineStartEdit = (event, payload) => {
    if (!win || !isWindowSender(event) || !payload || typeof payload !== "object") return;
    const pane = payload.pane === "right" ? "right" : "left";
    buffers.focusPane(pane);
    const paneBuffer = buffers.getPaneBuffer(pane);
    if (!paneBuffer || paneBuffer.isEditable) {
      return;
    }
    startUrllineEdit(pane, paneBuffer.url || "about:blank");
  };

  const onUrllineAction = (event, payload) => {
    if (!win || !isWindowSender(event) || !payload || typeof payload !== "object") return;
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
    }
  };

  const onEditorToggleContext = (event) => {
    if (!win || !isEditableSender(event)) return;
    dispatch(win, { type: INTENTS.TOGGLE_FOCUS_CONTEXT }, state);
    uiShell.updateStatuslineMode(getStatuslineModeLabel());
  };

  const onEditorModeChange = (event, payload) => {
    if (!win || !isEditableSender(event) || !payload || typeof payload !== "object") return;
    const nextMode = payload.mode === "INSERT" || payload.mode === "NORMAL" ? payload.mode : "NORMAL";
    setEditorMode(state, nextMode);
    uiShell.updateStatuslineMode(getStatuslineModeLabel());
  };

  const onEditorFocusRequest = (event) => {
    if (!win || !isEditableSender(event)) return;
    setEditorFocused(state, true);
    focusActiveEditorSurface();
    uiShell.updateStatuslineMode(getStatuslineModeLabel());
  };

  const onEditorOpenCommand = (event, payload) => {
    if (!win || !isEditableSender(event) || !payload || typeof payload !== "object") return;
    const initialText = typeof payload.initialText === "string" ? payload.initialText : "";
    enterCommandMode(state, {
      target: "EDITOR",
      initialText,
      reason: "editor-open-command",
    });
    dispatch(win, { type: INTENTS.SHOW_COMMAND }, state);
    dispatch(win, { type: INTENTS.COMMAND_INPUT }, state);
  };

  const onEditorReady = (event) => {
    if (!win || !isEditableSender(event)) return;
    setEditorFocused(state, true);
    setEditorMode(state, "NORMAL");
    focusActiveEditorSurface({ forceNormal: true });
    uiShell.updateStatuslineMode(getStatuslineModeLabel());
  };

  const onSettingsGet = async (event) => {
    if (!win || !isEditableSender(event, { requireActiveBuffer: true })) {
      return { ok: false };
    }
    const activeBuffer = buffers.getActive();
    const configPath =
      activeBuffer && activeBuffer.isEditable && typeof activeBuffer.editableFilePath === "string"
        ? activeBuffer.editableFilePath
        : configService.getConfigPath();
    try {
      const content = fs.readFileSync(configPath, "utf8");
      const themeContext = resolveCurrentTheme();
      return {
        ok: true,
        content,
        leaderKey: configService.getConfigValue("global.input.leader_key", "Space"),
        relativeLineNumbers: configService.getConfigValue("global.editor.relative_line_numbers", true),
        scrolloffLines: configService.getConfigValue("global.editor.scrolloff_lines", 3),
        ...buildThemePayload(themeContext),
      };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const onSettingsSave = async (event, payload) => {
    if (!win || !isEditableSender(event, { requireActiveBuffer: true })) {
      return { ok: false };
    }
    const activeBuffer = buffers.getActive();
    const configPath =
      activeBuffer && activeBuffer.isEditable && typeof activeBuffer.editableFilePath === "string"
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

  const onSettingsClose = async (event) => {
    if (!win || !isEditableSender(event, { requireActiveBuffer: true })) {
      return { ok: false };
    }
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
    "ui-shell:window-action": onWindowAction,
    "ui-shell:open-settings": onOpenSettings,
    "ui-shell:new-tab": onNewTab,
    "ui-shell:open-history": onOpenHistory,
    "ui-shell:tab-activate": onTabActivate,
    "ui-shell:tab-close": onTabClose,
    "ui-shell:urlline-start-edit": onUrllineStartEdit,
    "ui-shell:urlline-action": onUrllineAction,
    "settings:editor-toggle-context": onEditorToggleContext,
    "settings:editor-mode-change": onEditorModeChange,
    "settings:editor-focus-request": onEditorFocusRequest,
    "settings:editor-open-command": onEditorOpenCommand,
    "settings:editor-ready": onEditorReady,
  };

  const ipcHandlers = {
    "settings:get": onSettingsGet,
    "settings:save": onSettingsSave,
    "settings:close": onSettingsClose,
  };

  if (process.env.NOCTRA_SMOKE_TEST === "1") {
    ipcHandlers["security:probe-privileged-ipc"] = onSecurityProbePrivilegedIpc;
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

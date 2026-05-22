const { Menu } = require("electron");

function createSmokeScenarios({
  app,
  win,
  fs,
  state,
  buffers,
  dispatch,
  INTENTS,
  configService,
  sidepanelController,
  uiShell,
  webContentsActions,
  isEditorFocused,
  getStatuslineModeLabel,
  updateTablineOptions,
  updateUrllineRender,
}) {
  let smokeUiCadenceProbe = null;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function waitForCondition(check, options = {}) {
    const timeoutMs = Number.isFinite(options.timeoutMs)
      ? Math.max(50, options.timeoutMs)
      : 3000;
    const intervalMs = Number.isFinite(options.intervalMs)
      ? Math.max(20, options.intervalMs)
      : 50;
    const description =
      typeof options.description === "string"
        ? options.description
        : "condition";
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        if (check()) {
          return;
        }
      } catch (_error) {
        void _error;
      }
      await sleep(intervalMs);
    }
    throw new Error(`Timed out waiting for ${description}`);
  }

  async function runSecurityBoundarySmokeScenario() {
    const failures = [];
    const fail = (message) => failures.push(message);
    const untrustedBuffer = buffers.create("about:blank", { activate: true });
    await sleep(250);

    const untrustedBridgeState = await webContentsActions.executeScript(
      untrustedBuffer.webContents,
      `({ hasUiShell: typeof window.uiShell !== "undefined", hasSettingsBridge: typeof window.settingsBridge !== "undefined" })`,
      true,
    );
    if (
      !untrustedBridgeState ||
      untrustedBridgeState.hasUiShell ||
      untrustedBridgeState.hasSettingsBridge
    ) {
      fail("untrusted buffer has privileged preload bridge");
    }

    const trustedUrlBefore = win.webContents.getURL();
    try {
      await win.webContents.loadURL("https://example.com");
    } catch (_error) {
      void _error;
    }
    await sleep(200);
    const trustedUrlAfter = win.webContents.getURL();
    if (trustedUrlAfter !== trustedUrlBefore) {
      fail("trusted shell navigated to remote URL");
    }

    const probeResult = await win.webContents.executeJavaScript(
      `window.uiShell && typeof window.uiShell.probePrivilegedIpc === "function" ? window.uiShell.probePrivilegedIpc() : null`,
      true,
    );
    if (!probeResult || !probeResult.ok) {
      fail("security privileged IPC probe unavailable");
    } else {
      if (!probeResult.rejected || probeResult.rejected.settingsGet !== true) {
        fail("unauthorized sender/frame not rejected for settings:get");
      }
      if (!probeResult.rejected || probeResult.rejected.settingsSave !== true) {
        fail("unauthorized sender/frame not rejected for settings:save");
      }
      if (
        !probeResult.rejected ||
        probeResult.rejected.settingsClose !== true
      ) {
        fail("unauthorized sender/frame not rejected for settings:close");
      }
    }

    const popupResult = await webContentsActions.executeScript(
      untrustedBuffer.webContents,
      `(() => { try { const w = window.open("https://example.com"); return { opened: Boolean(w) }; } catch { return { opened: false }; } })()`,
      true,
    );
    if (popupResult && popupResult.opened === true) {
      fail("window.open was not blocked");
    }

    if (failures.length > 0) {
      console.error(
        "[noctra:smoke] security-boundary scenario failed",
        failures.join(" | "),
      );
      process.exitCode = 1;
    }
  }

  async function runSettingsLifecycleSmokeScenario() {
    const failures = [];
    const fail = (message) => failures.push(message);
    const configPath = configService.getConfigPath();
    const originalContent = fs.readFileSync(configPath, "utf8");
    dispatch(win, { type: INTENTS.OPEN_SETTINGS_BUFFER }, state);
    await waitForCondition(
      () => Boolean(buffers.getActive() && buffers.getActive().isEditable),
      {
        timeoutMs: 3500,
        description: "editable settings buffer",
      },
    ).catch((error) => fail(error.message));
    const settingsBuffer = buffers.getActive();
    if (
      !settingsBuffer ||
      !settingsBuffer.isEditable ||
      !settingsBuffer.webContents
    ) {
      fail("settings buffer did not open as editable");
    } else {
      const probe = await webContentsActions.executeScript(
        settingsBuffer.webContents,
        `(() => { const bridge = window.settingsBridge; return { hasBridge: Boolean(bridge), hasGet: Boolean(bridge && typeof bridge.get === "function"), hasClose: Boolean(bridge && typeof bridge.close === "function"), hasSave: Boolean(bridge && typeof bridge.save === "function") }; })()`,
        true,
      );
      if (
        !probe ||
        probe.hasBridge !== true ||
        probe.hasGet !== true ||
        probe.hasClose !== true ||
        probe.hasSave !== true
      ) {
        fail("settings bridge missing required methods");
      }
    }
    const editableBeforeClose = Boolean(
      buffers.getActive() && buffers.getActive().isEditable,
    );
    dispatch(win, { type: INTENTS.CLOSE_BUFFER }, state);
    await waitForCondition(
      () => Boolean(buffers.getActive() && !buffers.getActive().isEditable),
      { timeoutMs: 3500, description: "settings close to non-editable buffer" },
    ).catch((error) => fail(error.message));
    const activeAfterClose = buffers.getActive();
    if (!activeAfterClose) fail("no active buffer after settings close");
    if (editableBeforeClose && activeAfterClose && activeAfterClose.isEditable)
      fail("settings buffer remained active after close");
    fs.writeFileSync(configPath, originalContent, "utf8");
    if (failures.length > 0) {
      console.error(
        "[noctra:smoke] settings-lifecycle scenario failed",
        failures.join(" | "),
      );
      process.exitCode = 1;
    }
  }

  async function runDevtoolsLifecycleSmokeScenario() {
    const failures = [];
    const fail = (message) => failures.push(message);
    dispatch(win, { type: INTENTS.SPLIT_DEVTOOLS }, state);
    await waitForCondition(
      () => {
        const status = buffers.getSplitStatus();
        return Boolean(status && status.enabled && status.mode === "devtools");
      },
      { timeoutMs: 3000, description: "devtools split open" },
    ).catch((error) => fail(error.message));
    dispatch(win, { type: INTENTS.SPLIT_CLOSE_RIGHT }, state);
    await waitForCondition(
      () => {
        const status = buffers.getSplitStatus();
        return Boolean(
          status &&
          !status.enabled &&
          status.mode === "regular" &&
          status.focusedPane === "left",
        );
      },
      { timeoutMs: 3000, description: "devtools split close/reset" },
    ).catch((error) => fail(error.message));
    if (failures.length > 0) {
      console.error(
        "[noctra:smoke] devtools-lifecycle scenario failed",
        failures.join(" | "),
      );
      process.exitCode = 1;
    }
  }

  async function runSessionLifecycleSmokeScenario() {
    const failures = [];
    const fail = (message) => failures.push(message);
    buffers.create("https://example.com", { activate: true });
    buffers.create("https://example.org", { activate: true });
    await waitForCondition(() => buffers.getBuffers().length >= 2, {
      timeoutMs: 3000,
      description: "session seed buffers visible",
    }).catch((error) => fail(error.message));
    dispatch(win, { type: INTENTS.SESSION_SAVE }, state);
    dispatch(win, { type: INTENTS.SESSION_RESTORE }, state);
    await waitForCondition(() => buffers.getBuffers().length >= 2, {
      timeoutMs: 3500,
      description: "session restore",
    }).catch((error) => fail(error.message));
    if (failures.length > 0) {
      console.error(
        "[noctra:smoke] session-lifecycle scenario failed",
        failures.join(" | "),
      );
      process.exitCode = 1;
    }
  }

  async function runFocusLifecycleSmokeScenario() {
    const failures = [];
    const fail = (message) => failures.push(message);
    dispatch(win, { type: INTENTS.OPEN_SETTINGS_BUFFER }, state);
    await waitForCondition(
      () => Boolean(buffers.getActive() && buffers.getActive().isEditable),
      { timeoutMs: 3500, description: "focus-lifecycle settings buffer" },
    ).catch((error) => fail(error.message));
    await waitForCondition(() => Boolean(isEditorFocused(state)), {
      timeoutMs: 2500,
      description: "editor focused flag",
    }).catch((error) => fail(error.message));
    dispatch(win, { type: INTENTS.CLOSE_BUFFER }, state);
    await waitForCondition(
      () => Boolean(buffers.getActive() && !buffers.getActive().isEditable),
      { timeoutMs: 3500, description: "focus-lifecycle close settings buffer" },
    ).catch((error) => fail(error.message));
    if (isEditorFocused(state))
      fail("editor focused state remained true after leaving editable buffer");
    if (failures.length > 0) {
      console.error(
        "[noctra:smoke] focus-lifecycle scenario failed",
        failures.join(" | "),
      );
      process.exitCode = 1;
    }
  }

  function setupSmokeUiCadenceProbe() {
    if (
      process.env.NOCTRA_SMOKE_TEST !== "1" ||
      process.env.NOCTRA_SMOKE_SCENARIO !== "ui-cadence"
    ) {
      return;
    }
    const counters = { tabline: 0, urlline: 0, statusline: 0 };
    const originalRenderTabline = uiShell.renderTabline.bind(uiShell);
    const originalRenderUrlline = uiShell.renderUrlline.bind(uiShell);
    const originalUpdateStatuslineMode =
      uiShell.updateStatuslineMode.bind(uiShell);
    uiShell.renderTabline = (...args) => {
      counters.tabline += 1;
      return originalRenderTabline(...args);
    };
    uiShell.renderUrlline = (...args) => {
      counters.urlline += 1;
      return originalRenderUrlline(...args);
    };
    uiShell.updateStatuslineMode = (...args) => {
      counters.statusline += 1;
      return originalUpdateStatuslineMode(...args);
    };
    smokeUiCadenceProbe = {
      validate() {
        const failures = [];
        if (counters.tabline < 2)
          failures.push(`tabline updates too low: ${counters.tabline}`);
        if (counters.urlline < 2)
          failures.push(`urlline updates too low: ${counters.urlline}`);
        if (counters.statusline < 2)
          failures.push(`statusline updates too low: ${counters.statusline}`);
        if (failures.length > 0) {
          console.error(
            "[noctra:smoke] ui-cadence validation failed",
            failures.join(" | "),
          );
          process.exitCode = 1;
        }
      },
    };
  }

  function maybeScheduleSmokeExit() {
    if (process.env.NOCTRA_SMOKE_TEST !== "1") {
      return;
    }
    const scenario = process.env.NOCTRA_SMOKE_SCENARIO || "startup";
    const scenarioRunners = {
      startup: async () => {
        const menu = Menu.getApplicationMenu();
        if (!menu) {
          throw new Error("Application menu is null after startup");
        }
      },
      "overlay-panel-split": async () => {
        dispatch(win, { type: INTENTS.HISTORY_SHOW }, state);
        buffers.openVerticalSplit(0.5);
        buffers.focusSplitLeft();
        buffers.focusSplitRight();
        sidepanelController.focus();
        sidepanelController.unfocus();
        buffers.closeRightSplit();
      },
      "ui-cadence": async () => {
        buffers.openConfiguredBuffer();
        updateTablineOptions();
        updateUrllineRender();
        uiShell.updateStatuslineMode(getStatuslineModeLabel());
        dispatch(win, { type: INTENTS.HISTORY_SHOW }, state);
        sidepanelController.unfocus();
        if (smokeUiCadenceProbe) smokeUiCadenceProbe.validate();
      },
      "security-boundary": runSecurityBoundarySmokeScenario,
      "settings-lifecycle": runSettingsLifecycleSmokeScenario,
      "devtools-lifecycle": runDevtoolsLifecycleSmokeScenario,
      "session-lifecycle": runSessionLifecycleSmokeScenario,
      "focus-lifecycle": runFocusLifecycleSmokeScenario,
      "context-menu": async () => {
        const { buildWebContextMenuTemplate } = require("../core/adapters/platform/contextMenuBuilder");
        const { buildUIShellContextMenuTemplate } = require("../core/adapters/platform/contextMenuBuilder");
        const { buildSidepanelContextMenuTemplate } = require("../core/adapters/platform/contextMenuBuilder");

        // Verify web context menu template builds for editable input
        const webTemplate = buildWebContextMenuTemplate({
          params: { isEditable: true, x: 0, y: 0 },
          runtimeSnapshot: {
            canGoBack: false,
            canGoForward: false,
            defaultSearchEngine: "duckduckgo",
            isSplitEnabled: false,
            isRightPane: false,
            isBookmarkable: false,
          },
          actions: {},
        });
        if (!webTemplate || webTemplate.length === 0) {
          throw new Error("web context menu template is empty for editable input");
        }

        // Verify UI shell tabline template builds
        const uiTemplate = buildUIShellContextMenuTemplate({
          zone: "tabline",
          target: "tab",
          runtimeSnapshot: {
            isFirst: false,
            isLast: false,
            isSplitEnabled: false,
            isEditable: false,
            hasVirtualDocument: false,
            isDashboard: false,
          },
          actions: {},
        });
        if (!uiTemplate || uiTemplate.length === 0) {
          throw new Error("ui shell context menu template is empty for tabline");
        }

        // Verify sidepanel template builds
        const panelTemplate = buildSidepanelContextMenuTemplate({
          treeKind: "history",
          rowType: "entry",
          runtimeSnapshot: {},
          actions: {},
        });
        if (!panelTemplate || panelTemplate.length === 0) {
          throw new Error("sidepanel context menu template is empty for history entry");
        }

        // Open a buffer to ensure context menu registration is active
        const buffer = buffers.create("about:blank", { activate: true });
        await sleep(250);
        if (!buffer || !buffer.webContents) {
          throw new Error("context-menu smoke could not create buffer");
        }
      },
    };
    const runner = scenarioRunners[scenario] || scenarioRunners.startup;
    const watchdogMs = 12000;
    void (async () => {
      let settled = false;
      const watchdog = setTimeout(() => {
        if (settled) return;
        settled = true;
        process.exitCode = 1;
        console.error(
          `[noctra:smoke] ${scenario} scenario timed out after ${watchdogMs}ms`,
        );
        app.quit();
      }, watchdogMs);
      try {
        await sleep(350);
        await runner();
      } catch (error) {
        process.exitCode = 1;
        console.error(
          `[noctra:smoke] ${scenario} scenario failed`,
          error?.message || error,
        );
      } finally {
        if (!settled) {
          settled = true;
          clearTimeout(watchdog);
          app.quit();
        }
      }
    })();
  }

  return {
    setupSmokeUiCadenceProbe,
    maybeScheduleSmokeExit,
  };
}

module.exports = {
  createSmokeScenarios,
};

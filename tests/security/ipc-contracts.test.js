const test = require("node:test");
const assert = require("node:assert/strict");

const { validateIpcPayload } = require("../../core/contracts/ipc");
const { registerRuntimeIpc } = require("../../runtime/ipcRegistration");

function createRuntimeHarness() {
  const notifications = [];
  const registered = { events: {}, handlers: {} };
  const sideEffects = { switchedTo: null };
  const win = { webContents: {}, on() {} };
  const trustedSender = win.webContents;
  const trustedSettingsSender = {};
  const trustedEvent = { sender: trustedSender, senderFrame: { url: "noctra://shell" } };
  const trustedSettingsEvent = {
    sender: trustedSettingsSender,
    senderFrame: { url: "noctra://settings/config.yml" },
  };

  registerRuntimeIpc({
    win,
    fs: { readFileSync: () => "", writeFileSync: () => {} },
    ipcMain: {},
    state: {},
    buffers: {
      isEditableWebContents: () => true,
      getActiveWebContents: () => trustedSettingsSender,
      getPaneBuffer: () => null,
      focusPane: () => {},
      switchTo(id) {
        sideEffects.switchedTo = id;
      },
      close: () => {},
      getActive: () => ({ isEditable: true, editableFilePath: "/tmp/config.yml" }),
    },
    dispatch: () => {},
    INTENTS: { CLOSE_BUFFER: "CLOSE_BUFFER" },
    uiShell: { updateStatuslineMode: () => {} },
    historyPanel: { unfocus: () => {} },
    webContentsActions: { goBack: () => {}, goForward: () => {}, reload: () => {} },
    getSurfaceRole: (sender) => (sender === trustedSettingsSender ? "trusted:settings" : "trusted:shell"),
    isAllowedTrustedSurfaceUrl: () => true,
    SURFACE_ROLES: { TRUSTED_SHELL: "trusted:shell", TRUSTED_SETTINGS: "trusted:settings" },
    performWindowAction: () => {},
    setEditorFocused: () => {},
    enterCommandMode: () => {},
    focusActiveEditorSurface: () => {},
    getStatuslineModeLabel: () => "NORMAL",
    startUrllineEdit: () => {},
    configService: {
      getConfigPath: () => "/tmp/config.yml",
      getConfigValue: () => false,
      reloadConfig: () => ({}),
    },
    resolveCurrentTheme: () => ({}),
    buildThemePayload: () => ({}),
    applyReloadedConfig: () => {},
    registerIpcContracts: ({ events, handlers }) => {
      registered.events = events;
      registered.handlers = handlers;
      return () => {};
    },
    notificationsService: {
      notify(entry) {
        notifications.push(entry);
      },
    },
  });

  return { notifications, registered, sideEffects, trustedEvent, trustedSettingsEvent };
}

test("ipc payload validator accepts valid payload", () => {
  const result = validateIpcPayload("ui-shell:tab-activate", { id: 2 });
  assert.equal(result.ok, true);
});

test("ipc payload validator rejects unknown key", () => {
  const result = validateIpcPayload("ui-shell:tab-activate", { id: 2, extra: true });
  assert.equal(result.ok, false);
});

test("event rejection prevents side effects", () => {
  const harness = createRuntimeHarness();
  harness.registered.events["ui-shell:tab-activate"](harness.trustedEvent, { id: "2" });
  assert.equal(harness.sideEffects.switchedTo, null);
  assert.equal(harness.notifications.at(-1).code, "contract_invalid_payload");
});

test("invoke rejection shape is stable and machine-readable", async () => {
  const harness = createRuntimeHarness();
  const result = await harness.registered.handlers["settings:save"](harness.trustedSettingsEvent, {});
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "contract_invalid_payload");
  assert.equal(result.error.boundary, "ipc:invoke");
  assert.equal(result.error.subject, "settings:save");
});

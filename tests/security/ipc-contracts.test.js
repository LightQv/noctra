const test = require("node:test");
const assert = require("node:assert/strict");

const { validateIpcPayload } = require("../../core/contracts/ipc");
const { registerRuntimeIpc } = require("../../runtime/ipcRegistration");

function createRuntimeHarness() {
  const notifications = [];
  const registered = { events: {}, handlers: {} };
  const sideEffects = { switchedTo: null, dispatched: [] };
  const win = { webContents: {}, on() {} };
  const trustedSender = win.webContents;
  const trustedSettingsSender = {};
  const untrustedSender = {};
  const extensionSender = {};
  const trustedEvent = {
    sender: trustedSender,
    senderFrame: { url: "noctra://shell" },
  };
  const trustedSettingsEvent = {
    sender: trustedSettingsSender,
    senderFrame: { url: "noctra://settings/config.yml" },
  };
  const untrustedEvent = {
    sender: untrustedSender,
    senderFrame: { url: "https://example.com" },
  };
  const extensionEvent = {
    sender: extensionSender,
    senderFrame: { url: "chrome-extension://nngceckbapebfimnlniiiahkandclblb/popup.html" },
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
      getActive: () => ({
        isEditable: true,
        editableFilePath: "/tmp/config.yml",
      }),
    },
    dispatch: (_win, intent) => {
      sideEffects.dispatched.push(intent);
    },
    INTENTS: {
      CLOSE_BUFFER: "CLOSE_BUFFER",
      PASSWORD_MANAGER_OPEN: "PASSWORD_MANAGER_OPEN",
    },
    uiShell: { updateStatuslineMode: () => {} },
    sidepanelController: { unfocus: () => {} },
    webContentsActions: {
      goBack: () => {},
      goForward: () => {},
      reload: () => {},
    },
    getSurfaceRole: (sender) =>
      sender === trustedSettingsSender
        ? "trusted:settings"
        : sender === extensionSender
          ? "extension"
          : "trusted:shell",
    isAllowedTrustedSurfaceUrl: () => true,
    SURFACE_ROLES: {
      TRUSTED_SHELL: "trusted:shell",
      TRUSTED_SETTINGS: "trusted:settings",
      EXTENSION: "extension",
    },
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

  return {
    notifications,
    registered,
    sideEffects,
    trustedEvent,
    trustedSettingsEvent,
    untrustedEvent,
    extensionEvent,
  };
}

test("ipc payload validator accepts valid payload", () => {
  const result = validateIpcPayload("ui-shell:tab-activate", { id: 2 });
  assert.equal(result.ok, true);
});

test("ipc payload validator rejects unknown key", () => {
  const result = validateIpcPayload("ui-shell:tab-activate", {
    id: 2,
    extra: true,
  });
  assert.equal(result.ok, false);
});

test("event rejection prevents side effects", () => {
  const harness = createRuntimeHarness();
  harness.registered.events["ui-shell:tab-activate"](harness.trustedEvent, {
    id: "2",
  });
  assert.equal(harness.sideEffects.switchedTo, null);
  assert.equal(harness.notifications.at(-1).code, "contract_invalid_payload");
});

test("invoke rejection shape is stable and machine-readable", async () => {
  const harness = createRuntimeHarness();
  const result = await harness.registered.handlers["settings:save"](
    harness.trustedSettingsEvent,
    {},
  );
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "contract_invalid_payload");
  assert.equal(result.error.boundary, "ipc:invoke");
  assert.equal(result.error.subject, "settings:save");
});

test("ui-shell:context-menu accepts valid tabline payload", () => {
  const result = validateIpcPayload("ui-shell:context-menu", {
    zone: "tabline",
    target: "tab",
    tabId: 3,
    x: 120,
    y: 45,
  });
  assert.equal(result.ok, true);
});

test("ui-shell:context-menu accepts valid urlline payload", () => {
  const result = validateIpcPayload("ui-shell:context-menu", {
    zone: "urlline",
    target: "url",
    pane: "left",
    x: 200,
    y: 60,
  });
  assert.equal(result.ok, true);
});

test("settings:editor-open-search accepts empty payload", () => {
  const result = validateIpcPayload("settings:editor-open-search", undefined);
  assert.equal(result.ok, true);
});

test("ui-shell:open-password-manager accepts empty or null payload", () => {
  assert.equal(
    validateIpcPayload("ui-shell:open-password-manager", undefined).ok,
    true,
  );
  assert.equal(
    validateIpcPayload("ui-shell:open-password-manager", null).ok,
    true,
  );
  assert.equal(
    validateIpcPayload("ui-shell:open-password-manager", {}).ok,
    true,
  );
});

test("ui-shell:open-password-manager rejects non-empty payload", () => {
  const result = validateIpcPayload("ui-shell:open-password-manager", {
    provider: "bitwarden",
  });

  assert.equal(result.ok, false);
});

test("ui-shell:open-password-manager dispatches intent from trusted shell only", () => {
  const harness = createRuntimeHarness();

  harness.registered.events["ui-shell:open-password-manager"](
    harness.trustedEvent,
    undefined,
  );
  assert.deepEqual(harness.sideEffects.dispatched.at(-1), {
    type: "PASSWORD_MANAGER_OPEN",
  });

  harness.registered.events["ui-shell:open-password-manager"](
    harness.untrustedEvent,
    undefined,
  );
  assert.equal(harness.sideEffects.dispatched.length, 1);
});

test("extension-role sender cannot open password manager IPC", () => {
  const harness = createRuntimeHarness();

  harness.registered.events["ui-shell:open-password-manager"](
    harness.extensionEvent,
    undefined,
  );

  assert.equal(harness.sideEffects.dispatched.length, 0);
});

test("ui-shell:context-menu rejects invalid zone", () => {
  const result = validateIpcPayload("ui-shell:context-menu", {
    zone: "invalid",
    x: 0,
    y: 0,
  });
  assert.equal(result.ok, false);
});

test("ui-shell:context-menu rejects missing x", () => {
  const result = validateIpcPayload("ui-shell:context-menu", {
    zone: "tabline",
    y: 0,
  });
  assert.equal(result.ok, false);
});

test("ui-shell:context-menu event rejection prevents side effects", () => {
  const harness = createRuntimeHarness();
  harness.registered.events["ui-shell:context-menu"](harness.trustedEvent, {
    zone: "tabline",
    target: "tab",
    tabId: "not-a-number",
    x: 0,
    y: 0,
  });
  assert.equal(harness.notifications.at(-1).code, "contract_invalid_payload");
});

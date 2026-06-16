const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ManagedExtensionService,
} = require("../../core/extensions/managedExtensionService");

const FAKE_EXTENSION = Object.freeze({
  id: "fakebuiltinextensionid",
  name: "fake-builtin",
  label: "Fake Builtin",
  category: "developer-tool",
  support: "experimental",
});

const DISABLED_EXTENSION = Object.freeze({
  id: null,
  name: "none",
  label: "None",
  category: "developer-tool",
  support: "disabled",
});

const MESSAGES = Object.freeze({
  runtimeUnavailable: "Runtime unavailable.",
  notInstalled: "Extension is not installed.",
  retryInstall: "Extension is not installed. Restart Noctra to retry.",
  initializeFailed: "Extension failed to initialize.",
  invalidInstaller: "Installer is invalid.",
  serviceWorkerStartSkipped: "Background worker explicit start was skipped.",
  serviceWorkerStartFailed: "Background worker failed to start.",
  popupUnavailable: "Popup is unavailable.",
});

const CODES = Object.freeze({
  installFailed: "fake_install_failed",
  extensionFailed: "fake_failed",
  disableRestartRequired: "fake_disable_restart_required",
  switchRestartRequired: "fake_switch_restart_required",
  unloadFailed: "fake_unload_failed",
  serviceWorkerStartFailed: "fake_worker_start_failed",
  installStarted: "fake_install_started",
  updateFailed: "fake_update_failed",
});

function createStatus(extension, state, message = "") {
  const enabled = extension.name !== "none";
  return {
    extension: extension.name,
    label: extension.label,
    state,
    extensionId: extension.id,
    enabled,
    restartRequired: state.endsWith("_restart_required"),
    canOpen: enabled && state === "loaded",
    message,
  };
}

function makeService(options = {}) {
  return new ManagedExtensionService({
    configService: {
      getConfigValue(pathKey, fallback) {
        return pathKey === "browser.fake_builtin.enabled"
          ? options.enabledName || "fake-builtin"
          : fallback;
      },
    },
    session: options.session || {
      extensions: {
        getAllExtensions() {
          return options.installed ? [{ id: FAKE_EXTENSION.id }] : [];
        },
      },
    },
    extensionRuntime: options.extensionRuntime || { enabled: true },
    notificationsService: options.notificationsService,
    installer: options.installer,
    loadExtension: options.loadExtension,
    getConfiguredExtension(configService) {
      const name = configService.getConfigValue(
        "browser.fake_builtin.enabled",
        "none",
      );
      return name === "fake-builtin" ? FAKE_EXTENSION : DISABLED_EXTENSION;
    },
    isExtensionEnabled(name) {
      return name === "fake-builtin";
    },
    createStatus,
    initialExtension: DISABLED_EXTENSION,
    messages: MESSAGES,
    codes: CODES,
    source: "fakeBuiltinService",
  });
}

test("managed extension service loads non-password builtin extension", async () => {
  const loaded = [];
  const service = makeService({
    installed: true,
    loadExtension: async (extension, options) => {
      loaded.push({ extension, options });
    },
  });

  const status = await service.initialize();

  assert.equal(status.extension, "fake-builtin");
  assert.equal(status.state, "loaded");
  assert.equal(status.canOpen, true);
  assert.equal(loaded[0].extension.id, FAKE_EXTENSION.id);
  assert.equal(loaded[0].options.extension.id, FAKE_EXTENSION.id);
  assert.equal(loaded[0].options.provider.id, FAKE_EXTENSION.id);
});

test("managed extension service installs non-password builtin extension", async () => {
  const installed = [];
  const notifications = [];
  const service = makeService({
    installer: {
      async installExtension(extensionId, options) {
        installed.push({ extensionId, options });
      },
    },
    notificationsService: {
      notify(notification) {
        notifications.push(notification);
      },
    },
  });

  const status = await service.initialize();

  assert.equal(status.state, "loaded");
  assert.equal(installed[0].extensionId, FAKE_EXTENSION.id);
  assert.equal(installed[0].options.extension.id, FAKE_EXTENSION.id);
  assert.equal(notifications[0].code, "fake_install_started");
  assert.equal(notifications[0].source, "fakeBuiltinService");
});

test("managed extension service opens loaded builtin popup", async () => {
  const opened = [];
  const service = makeService({
    installed: true,
    extensionRuntime: {
      enabled: true,
      async openActionPopup(extensionName) {
        opened.push(extensionName);
        return true;
      },
    },
  });

  await service.initialize();
  const status = await service.open();

  assert.equal(status.state, "loaded");
  assert.deepEqual(opened, ["fake-builtin"]);
});

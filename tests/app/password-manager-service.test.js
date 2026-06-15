const test = require("node:test");
const assert = require("node:assert/strict");

const {
  PasswordManagerService,
} = require("../../core/extensions/passwordManagerService");

const BITWARDEN_ID = "nngceckbapebfimnlniiiahkandclblb";
const ONE_PASSWORD_ID = "aeblfdkhhhdcdjpifhhbdiojplfjncoa";

function makeConfigService(provider) {
  return {
    getConfigValue(pathKey, fallback) {
      if (pathKey === "browser.password_manager.provider") {
        return provider;
      }

      return fallback;
    },
  };
}

function makeSession(extensions = []) {
  return {
    extensions: {
      getAllExtensions() {
        return extensions;
      },
    },
  };
}

function makeRuntime() {
  const calls = [];
  return {
    enabled: true,
    calls,
    async openActionPopup(provider) {
      calls.push(provider);
      return true;
    },
  };
}

function makeNotifications() {
  const notifications = [];
  return {
    notifications,
    notify(notification) {
      notifications.push(notification);
    },
  };
}

test("password manager service disables provider none", async () => {
  const statusChanges = [];
  const service = new PasswordManagerService({
    configService: makeConfigService("none"),
    session: makeSession([{ id: BITWARDEN_ID }]),
    extensionRuntime: makeRuntime(),
    onStatusChange: (status) => statusChanges.push(status),
  });

  const status = await service.initialize();

  assert.equal(status.provider, "none");
  assert.equal(status.state, "disabled");
  assert.equal(status.enabled, false);
  assert.equal(status.canOpen, false);
  assert.deepEqual(
    statusChanges.map((item) => item.state),
    ["disabled"],
  );
});

test("password manager service loads existing provider", async () => {
  const loaded = [];
  const statusChanges = [];
  const service = new PasswordManagerService({
    configService: makeConfigService("bitwarden"),
    session: makeSession([{ id: BITWARDEN_ID }]),
    extensionRuntime: makeRuntime(),
    loadExtension: async (provider) => loaded.push(provider.id),
    onStatusChange: (status) => statusChanges.push(status),
  });

  const status = await service.initialize();

  assert.equal(status.provider, "bitwarden");
  assert.equal(status.state, "loaded");
  assert.equal(status.enabled, true);
  assert.equal(status.canOpen, true);
  assert.deepEqual(loaded, [BITWARDEN_ID]);
  assert.deepEqual(
    statusChanges.map((item) => item.state),
    ["loading", "loaded"],
  );
});

test("password manager service coalesces concurrent initialize calls", async () => {
  let loadCalls = 0;
  let releaseLoad;
  const service = new PasswordManagerService({
    configService: makeConfigService("bitwarden"),
    session: makeSession([{ id: BITWARDEN_ID }]),
    extensionRuntime: makeRuntime(),
    loadExtension: async () => {
      loadCalls += 1;
      await new Promise((resolve) => {
        releaseLoad = resolve;
      });
    },
  });

  const firstInitialize = service.initialize();
  const secondInitialize = service.initialize();
  await new Promise((resolve) => setImmediate(resolve));
  releaseLoad();
  const statuses = await Promise.all([firstInitialize, secondInitialize]);

  assert.equal(loadCalls, 1);
  assert.equal(statuses[0].state, "loaded");
  assert.equal(statuses[1].state, "loaded");
});

test("password manager service applies provider disable on reinitialize", async () => {
  let provider = "bitwarden";
  const service = new PasswordManagerService({
    configService: makeConfigService("bitwarden"),
    session: makeSession([{ id: BITWARDEN_ID }]),
    extensionRuntime: makeRuntime(),
  });

  service.configService = {
    getConfigValue() {
      return provider;
    },
  };

  assert.equal((await service.initialize()).state, "loaded");
  provider = "none";
  const status = await service.initialize();

  assert.equal(status.state, "disabled_restart_required");
  assert.equal(status.restartRequired, true);
  assert.equal(status.canOpen, false);
  assert.match(status.message, /remains loaded until Noctra restarts/);
});

test("password manager service unloads active provider when supported", async () => {
  let provider = "bitwarden";
  const extensions = [{ id: BITWARDEN_ID }];
  const removed = [];
  const service = new PasswordManagerService({
    configService: {
      getConfigValue() {
        return provider;
      },
    },
    session: {
      extensions: {
        getAllExtensions() {
          return extensions;
        },
        removeExtension(extensionId) {
          removed.push(extensionId);
          const index = extensions.findIndex(
            (extension) => extension.id === extensionId,
          );
          if (index >= 0) {
            extensions.splice(index, 1);
          }
        },
      },
    },
    extensionRuntime: makeRuntime(),
  });

  assert.equal((await service.initialize()).state, "loaded");
  provider = "none";
  const status = await service.initialize();

  assert.equal(status.state, "disabled");
  assert.equal(status.restartRequired, false);
  assert.deepEqual(removed, [BITWARDEN_ID]);
});

test("password manager service blocks provider switch until restart without unload", async () => {
  let provider = "bitwarden";
  const service = new PasswordManagerService({
    configService: {
      getConfigValue() {
        return provider;
      },
    },
    session: makeSession([{ id: BITWARDEN_ID }, { id: ONE_PASSWORD_ID }]),
    extensionRuntime: makeRuntime(),
  });

  assert.equal((await service.initialize()).state, "loaded");
  provider = "1password";
  const status = await service.initialize();

  assert.equal(status.provider, "1password");
  assert.equal(status.state, "switch_restart_required");
  assert.equal(status.restartRequired, true);
  assert.equal(status.canOpen, false);
  assert.match(status.message, /Restart Noctra to switch to 1Password/);
});

test("password manager service installs missing provider", async () => {
  const installed = [];
  const loaded = [];
  const notifications = makeNotifications();
  const statusChanges = [];
  const service = new PasswordManagerService({
    configService: makeConfigService("bitwarden"),
    session: makeSession([]),
    extensionRuntime: makeRuntime(),
    notificationsService: notifications,
    installer: {
      async installExtension(extensionId, options) {
        installed.push({ extensionId, options });
      },
    },
    loadExtension: async (provider) => loaded.push(provider.id),
    onStatusChange: (status) => statusChanges.push(status),
  });

  const status = await service.initialize();

  assert.equal(status.state, "loaded");
  assert.equal(installed[0].extensionId, BITWARDEN_ID);
  assert.equal(installed[0].options.provider.name, "bitwarden");
  assert.deepEqual(loaded, [BITWARDEN_ID]);
  assert.deepEqual(
    statusChanges.map((item) => item.state),
    ["installing", "loading", "loaded"],
  );
  assert.equal(
    notifications.notifications[0].code,
    "password_manager_extension_install_started",
  );
});

test("password manager service supports function installer", async () => {
  const installed = [];
  const service = new PasswordManagerService({
    configService: makeConfigService("bitwarden"),
    session: makeSession([]),
    extensionRuntime: makeRuntime(),
    installer: async (extensionId, options) => {
      installed.push({ extensionId, options });
    },
  });

  const status = await service.initialize();

  assert.equal(status.state, "loaded");
  assert.equal(installed[0].extensionId, BITWARDEN_ID);
  assert.equal(installed[0].options.provider.name, "bitwarden");
});

test("password manager service fails when installer is missing", async () => {
  const notifications = makeNotifications();
  const service = new PasswordManagerService({
    configService: makeConfigService("bitwarden"),
    session: makeSession([]),
    extensionRuntime: makeRuntime(),
    notificationsService: notifications,
  });

  const status = await service.initialize();

  assert.equal(status.state, "failed");
  assert.equal(status.canOpen, false);
  assert.equal(status.message, "Password manager extension is not installed.");
  assert.equal(notifications.notifications.length, 1);
  assert.equal(
    notifications.notifications[0].code,
    "password_manager_extension_failed",
  );
});

test("password manager service fails safely when runtime unavailable", async () => {
  const notifications = makeNotifications();
  const service = new PasswordManagerService({
    configService: makeConfigService("bitwarden"),
    session: makeSession([{ id: BITWARDEN_ID }]),
    extensionRuntime: { enabled: false },
    notificationsService: notifications,
  });

  const status = await service.initialize();

  assert.equal(status.state, "failed");
  assert.equal(status.message, "Chrome extension runtime is unavailable.");
  assert.equal(notifications.notifications.length, 1);
});

test("password manager service catches install failures", async () => {
  const notifications = makeNotifications();
  const service = new PasswordManagerService({
    configService: makeConfigService("bitwarden"),
    session: makeSession([]),
    extensionRuntime: makeRuntime(),
    notificationsService: notifications,
    installer: async () => {
      throw new Error("Network unavailable");
    },
  });

  const status = await service.initialize();

  assert.equal(status.state, "failed");
  assert.equal(status.message, "Network unavailable");
  assert.equal(notifications.notifications.length, 2);
  assert.equal(
    notifications.notifications[1].code,
    "password_manager_extension_install_failed",
  );
});

test("password manager service avoids repeated install retries in one session", async () => {
  let installCalls = 0;
  const service = new PasswordManagerService({
    configService: makeConfigService("bitwarden"),
    session: makeSession([]),
    extensionRuntime: makeRuntime(),
    installer: async () => {
      installCalls += 1;
      throw new Error("Network unavailable");
    },
  });

  const firstStatus = await service.initialize();
  const secondStatus = await service.initialize();

  assert.equal(firstStatus.state, "failed");
  assert.equal(secondStatus.state, "failed");
  assert.equal(installCalls, 1);
  assert.match(secondStatus.message, /Restart Noctra/);
});

test("password manager service keeps installed extension if update fails", async () => {
  const loaded = [];
  const notifications = makeNotifications();
  const service = new PasswordManagerService({
    configService: makeConfigService("bitwarden"),
    session: makeSession([{ id: BITWARDEN_ID }]),
    extensionRuntime: makeRuntime(),
    notificationsService: notifications,
    installer: {
      async updateExtensions() {
        throw new Error("Update failed");
      },
    },
    loadExtension: async (provider) => loaded.push(provider.id),
  });

  const status = await service.initialize();

  assert.equal(status.state, "loaded");
  assert.deepEqual(loaded, [BITWARDEN_ID]);
  assert.equal(
    notifications.notifications[0].code,
    "password_manager_extension_update_failed",
  );
});

test("password manager service initializes installer before checking installed extensions", async () => {
  const extensions = [];
  const loaded = [];
  const service = new PasswordManagerService({
    configService: makeConfigService("bitwarden"),
    session: makeSession(extensions),
    extensionRuntime: makeRuntime(),
    installer: {
      async initialize() {
        extensions.push({ id: BITWARDEN_ID });
      },
    },
    loadExtension: async (provider) => loaded.push(provider.id),
  });

  const status = await service.initialize();

  assert.equal(status.state, "loaded");
  assert.deepEqual(loaded, [BITWARDEN_ID]);
});

test("password manager service catches load failures", async () => {
  const service = new PasswordManagerService({
    configService: makeConfigService("bitwarden"),
    session: makeSession([{ id: BITWARDEN_ID }]),
    extensionRuntime: makeRuntime(),
    loadExtension: async () => {
      throw new Error("Load failed");
    },
  });

  const status = await service.initialize();

  assert.equal(status.state, "failed");
  assert.equal(status.message, "Load failed");
});

test("password manager service starts MV3 service worker after load", async () => {
  const scopes = [];
  const service = new PasswordManagerService({
    configService: makeConfigService("bitwarden"),
    session: {
      extensions: {
        getAllExtensions: () => [{ id: BITWARDEN_ID }],
      },
      serviceWorkers: {
        async startWorkerForScope(scope) {
          scopes.push(scope);
        },
      },
    },
    extensionRuntime: makeRuntime(),
    loadExtension: async () => ({
      id: BITWARDEN_ID,
      manifest: {
        manifest_version: 3,
        background: { service_worker: "background.js" },
      },
    }),
  });

  const status = await service.initialize();

  assert.equal(status.state, "loaded");
  assert.deepEqual(scopes, [`chrome-extension://${BITWARDEN_ID}/`]);
});

test("password manager service warns when explicit MV3 worker start fails", async () => {
  const notifications = makeNotifications();
  const service = new PasswordManagerService({
    configService: makeConfigService("bitwarden"),
    session: {
      extensions: {
        getAllExtensions: () => [{ id: BITWARDEN_ID }],
      },
      serviceWorkers: {
        async startWorkerForScope() {
          throw new Error("Worker failed");
        },
      },
    },
    extensionRuntime: makeRuntime(),
    notificationsService: notifications,
    loadExtension: async () => ({
      id: BITWARDEN_ID,
      manifest: {
        manifest_version: 3,
        background: { service_worker: "background.js" },
      },
    }),
  });

  const status = await service.initialize();

  assert.equal(status.state, "loaded");
  assert.equal(status.canOpen, true);
  assert.equal(
    notifications.notifications[0].code,
    "password_manager_service_worker_start_failed",
  );
  assert.equal(notifications.notifications[0].context.message, "Worker failed");
});

test("password manager service open is blocked until loaded", async () => {
  const runtime = makeRuntime();
  const service = new PasswordManagerService({
    configService: makeConfigService("none"),
    extensionRuntime: runtime,
  });

  const status = await service.open();

  assert.equal(status.state, "disabled");
  assert.deepEqual(runtime.calls, []);
});

test("password manager service open delegates when loaded", async () => {
  const runtime = makeRuntime();
  const service = new PasswordManagerService({
    configService: makeConfigService("bitwarden"),
    session: makeSession([{ id: BITWARDEN_ID }]),
    extensionRuntime: runtime,
  });

  await service.initialize();
  const status = await service.open();

  assert.equal(status.state, "loaded");
  assert.deepEqual(runtime.calls, ["bitwarden"]);
});

test("password manager service fails when popup cannot open", async () => {
  const notifications = makeNotifications();
  const service = new PasswordManagerService({
    configService: makeConfigService("bitwarden"),
    session: makeSession([{ id: BITWARDEN_ID }]),
    extensionRuntime: {
      enabled: true,
      openActionPopup: async () => false,
    },
    notificationsService: notifications,
  });

  await service.initialize();
  const status = await service.open();

  assert.equal(status.state, "failed");
  assert.equal(status.canOpen, false);
  assert.equal(status.message, "Password manager popup is unavailable.");
  assert.equal(
    notifications.notifications.at(-1).code,
    "password_manager_extension_failed",
  );
});

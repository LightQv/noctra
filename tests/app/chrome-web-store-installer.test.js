const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  createChromeWebStoreInstaller,
  createUnavailableInstaller,
} = require("../../core/extensions/chromeWebStoreInstaller");

test("chrome web store installer initializes support once before install", async () => {
  const calls = [];
  const session = { name: "default" };
  const webStore = {
    async installChromeWebStore(options) {
      calls.push(["installChromeWebStore", options]);
    },
    async installExtension(extensionId, options) {
      calls.push(["installExtension", extensionId, options]);
    },
  };
  const installer = createChromeWebStoreInstaller({
    webStore,
    session,
    allowlist: ["abc"],
    autoUpdate: false,
    loadExtensions: true,
  });

  await installer.installExtension("abc");
  await installer.installExtension("abc");

  assert.equal(installer.enabled, true);
  assert.deepEqual(calls.map((item) => item[0]), [
    "installChromeWebStore",
    "installExtension",
    "installExtension",
  ]);
  assert.deepEqual(calls[0][1], {
    session,
    autoUpdate: false,
    loadExtensions: true,
    allowlist: ["abc"],
  });
  assert.deepEqual(calls[1], ["installExtension", "abc", { session }]);
});

test("chrome web store installer delegates update and load helpers", async () => {
  const calls = [];
  const session = { name: "default" };
  const webStore = {
    async installExtension() {},
    async loadAllExtensions(targetSession, extensionsPath, options) {
      calls.push(["loadAllExtensions", targetSession, extensionsPath, options]);
    },
    async updateExtensions(targetSession) {
      calls.push(["updateExtensions", targetSession]);
    },
  };
  const installer = createChromeWebStoreInstaller({
    webStore,
    session,
    extensionsPath: "/tmp/extensions",
  });

  await installer.loadExtension("abc");
  await installer.updateExtensions();

  assert.deepEqual(calls, [
    [
      "loadAllExtensions",
      session,
      "/tmp/extensions",
      { allowUnpacked: false },
    ],
    ["updateExtensions", session],
  ]);
});

test("chrome web store installer loads selected installed extension directly", async () => {
  const extensionsPath = fs.mkdtempSync(path.join(os.tmpdir(), "noctra-ext-"));
  const extensionPath = path.join(extensionsPath, "abc", "2.0.0_0");
  fs.mkdirSync(extensionPath, { recursive: true });
  fs.writeFileSync(path.join(extensionPath, "manifest.json"), "{}", "utf8");

  const calls = [];
  const session = {
    extensions: {
      getExtension: () => null,
      async loadExtension(targetPath, options) {
        calls.push([targetPath, options]);
        return { id: "abc" };
      },
    },
  };
  const installer = createChromeWebStoreInstaller({
    webStore: {
      async installExtension() {},
    },
    session,
    extensionsPath,
  });

  assert.equal(installer.hasInstalledExtension("abc"), true);
  const extension = await installer.loadExtension("abc");

  assert.deepEqual(extension, { id: "abc" });
  assert.deepEqual(calls, [[extensionPath, { allowFileAccess: false }]]);
});

test("chrome web store installer skips loadAllExtensions without explicit path", async () => {
  let loadCalls = 0;
  const webStore = {
    async installExtension() {},
    async loadAllExtensions() {
      loadCalls += 1;
    },
  };
  const installer = createChromeWebStoreInstaller({ webStore });

  const result = await installer.loadExtension("abc");

  assert.equal(result, false);
  assert.equal(loadCalls, 0);
});

test("unavailable chrome web store installer fails install clearly", () => {
  const installer = createUnavailableInstaller("No package");

  assert.equal(installer.enabled, false);
  assert.throws(() => installer.installExtension("abc"), /No package/);
});

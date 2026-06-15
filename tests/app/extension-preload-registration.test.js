const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const {
  EXTENSION_PRELOAD_MODULES,
  registerChromeExtensionPreloads,
  registerPreload,
} = require("../../core/extensions/extensionPreloadRegistration");

test("registerChromeExtensionPreloads registers package preloads on default session", () => {
  const registered = [];
  const fakeSession = {
    defaultSession: {
      registerPreloadScript(options) {
        registered.push(options);
        return `script-${registered.length}`;
      },
    },
  };

  const results = registerChromeExtensionPreloads({
    session: fakeSession,
    resolveModule: (moduleName) => `/resolved/${moduleName}.js`,
  });

  assert.deepEqual(
    registered,
    EXTENSION_PRELOAD_MODULES.map((moduleName) => ({
      type: "frame",
      filePath: `/resolved/${moduleName}.js`,
    })),
  );
  assert.deepEqual(
    results.map((result) => result.method),
    ["registerPreloadScript", "registerPreloadScript"],
  );
});

test("registerPreload falls back to additive setPreloads", () => {
  const calls = [];
  const fakeSession = {
    getPreloads: () => ["/existing.js"],
    setPreloads(preloads) {
      calls.push(preloads);
    },
  };

  const result = registerPreload(fakeSession, "/extension.js");

  assert.equal(result.registered, true);
  assert.equal(result.method, "setPreloads");
  assert.deepEqual(calls, [["/existing.js", "/extension.js"]]);
});

test("registerPreload does not duplicate existing fallback preloads", () => {
  const calls = [];
  const fakeSession = {
    getPreloads: () => ["/extension.js"],
    setPreloads(preloads) {
      calls.push(preloads);
    },
  };

  const result = registerPreload(fakeSession, "/extension.js");

  assert.equal(result.registered, true);
  assert.equal(result.method, "setPreloads");
  assert.deepEqual(calls, []);
});

test("extension preload modules resolve from installed packages", () => {
  for (const moduleName of EXTENSION_PRELOAD_MODULES) {
    assert.match(require.resolve(moduleName), /electron-chrome-/);
  }
});

test("extension package preload is gated to extension contexts", () => {
  const source = fs.readFileSync(
    require.resolve("electron-chrome-extensions/preload"),
    "utf8",
  );

  assert.match(source, /process\.type === ["']service-worker["']/);
  assert.match(source, /location\.href\.startsWith\(["']chrome-extension:\/\//);
  assert.match(source, /injectExtensionAPIs\(\)/);
});

test("web store preload is gated to Chrome Web Store origin", () => {
  const source = fs.readFileSync(
    require.resolve("electron-chrome-web-store/preload"),
    "utf8",
  );

  assert.match(
    source,
    /location\.href\.startsWith\(["']https:\/\/chromewebstore\.google\.com["']\)/,
  );
  assert.match(source, /setupChromeWebStoreApi\(\)/);
});

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("module");

const originalLoad = Module._load;

const openedUrls = [];

function loadOpenExternalUnderMock() {
  Module._load = function (request, parent) {
    if (request === "electron" && parent.filename.includes("openExternal.js")) {
      return {
        shell: {
          openExternal: (url) => {
            openedUrls.push(url);
            return Promise.resolve();
          },
        },
      };
    }
    return originalLoad.apply(this, arguments);
  };

  const key = require.resolve("../../core/adapters/platform/openExternal");
  delete require.cache[key];
  const mod = require("../../core/adapters/platform/openExternal");
  Module._load = originalLoad;
  return mod;
}

const { openDoc } = loadOpenExternalUnderMock();

test("openDoc builds URL from default base path", async () => {
  openedUrls.length = 0;
  const result = await openDoc("docs/getting-started.md");
  assert.equal(result.success, true);
  assert.ok(result.data.includes("github.com/LightQv/noctra/blob/main"));
  assert.ok(result.data.endsWith("docs/getting-started.md"));
});

test("openDoc builds URL for README", async () => {
  openedUrls.length = 0;
  const result = await openDoc("README.md");
  assert.equal(result.success, true);
  assert.ok(result.data.includes("github.com/LightQv/noctra/blob/main"));
  assert.ok(result.data.endsWith("README.md"));
});

test("openDoc rejects empty path", () => {
  const result = openDoc("");
  assert.equal(result.success, false);
  assert.equal(result.error.code, "INVALID_PATH");
});

test("openDoc rejects path traversal", () => {
  const result = openDoc("../package.json");
  assert.equal(result.success, false);
  assert.equal(result.error.code, "PATH_TRAVERSAL");
});

test("openDoc rejects absolute paths", () => {
  const result = openDoc("/etc/passwd");
  assert.equal(result.success, false);
  assert.equal(result.error.code, "PATH_TRAVERSAL");
});

test("openDoc rejects non-string input", () => {
  const result = openDoc(null);
  assert.equal(result.success, false);
  assert.equal(result.error.code, "INVALID_PATH");
});

test("openDoc rejects paths with double dots anywhere", () => {
  const result = openDoc("docs/../../etc/passwd");
  assert.equal(result.success, false);
  assert.equal(result.error.code, "PATH_TRAVERSAL");
});

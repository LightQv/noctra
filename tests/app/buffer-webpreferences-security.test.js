const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

test("Buffer webPreferences keep hardening and explicit default session", () => {
  const originalLoad = Module._load;
  const created = [];
  const fakeDefaultSession = { name: "defaultSession" };

  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === "electron") {
      return {
        BrowserView: class FakeBrowserView {
          constructor(options) {
            created.push(options);
            this.webContents = {
              on() {},
              isDestroyed: () => false,
              setWindowOpenHandler() {},
            };
          }
        },
        session: { defaultSession: fakeDefaultSession },
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  const bufferPath = require.resolve("../../browser/buffers");
  delete require.cache[bufferPath];

  try {
    const Buffer = require("../../browser/buffers");
    new Buffer(1);
  } finally {
    Module._load = originalLoad;
    delete require.cache[bufferPath];
  }

  assert.equal(created.length, 1);
  assert.deepEqual(created[0].webPreferences, {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webviewTag: false,
    session: fakeDefaultSession,
  });
});

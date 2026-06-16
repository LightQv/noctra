const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createRenderKey,
  getLiveWindowWebContents,
  renderLoadinglineBridge,
  renderTablineBridge,
  renderUrllineBridge,
  updateSplitDividerBridge,
} = require("../../ui/shell/services/shellRenderBridge");

test("shell render bridge skips destroyed BrowserWindow", () => {
  const context = {
    shellHostReady: true,
    window: {
      isDestroyed: () => true,
      get webContents() {
        throw new Error("webContents should not be read after destruction");
      },
    },
  };

  assert.doesNotThrow(() => renderUrllineBridge.call(context, { panes: [] }));
  assert.doesNotThrow(() => renderLoadinglineBridge.call(context, { panes: [] }));
  assert.doesNotThrow(() => updateSplitDividerBridge.call(context, {}));
});

test("shell render bridge skips destroyed shell webContents", () => {
  const webContents = { isDestroyed: () => true };
  const windowRef = {
    isDestroyed: () => false,
    webContents,
  };

  assert.equal(getLiveWindowWebContents(windowRef), null);
});

test("shell render bridge resolves live shell webContents", () => {
  const webContents = { isDestroyed: () => false };
  const windowRef = {
    isDestroyed: () => false,
    webContents,
  };

  assert.equal(getLiveWindowWebContents(windowRef), webContents);
});

test("shell render bridge omits functions from render cache keys", () => {
  assert.equal(
    createRenderKey({ label: "x", onClick() {} }),
    createRenderKey({ label: "x" }),
  );
});

test("urlline bridge skips duplicate renderer patches", () => {
  const calls = [];
  const context = {
    shellHostReady: true,
    urllineActions: {},
    urllineModel: { panes: [] },
    currentTheme: {},
    window: {
      isDestroyed: () => false,
      webContents: {
        isDestroyed: () => false,
        executeJavaScript(script) {
          calls.push(script);
          return Promise.resolve();
        },
      },
    },
  };

  const model = { panes: [{ pane: "left", url: "https://example.com" }] };
  renderUrllineBridge.call(context, model);
  renderUrllineBridge.call(context, model);

  assert.equal(calls.length, 1);
});

test("tabline bridge skips duplicate scheduled renders", async () => {
  const calls = [];
  const context = {
    shellHostReady: true,
    pendingTablineSnapshot: [],
    windowChrome: {},
    tablineActions: {},
    tablineOptions: {},
    urllineModel: { panes: [] },
    currentTheme: {},
    window: {
      isDestroyed: () => false,
      webContents: {
        isDestroyed: () => false,
        executeJavaScript(script) {
          calls.push(script);
          return Promise.resolve();
        },
      },
    },
  };

  const snapshot = [{ id: 1, title: "One", isActive: true }];
  renderTablineBridge.call(context, snapshot);
  await new Promise((resolve) => setTimeout(resolve, 25));
  renderTablineBridge.call(context, snapshot);
  await new Promise((resolve) => setTimeout(resolve, 25));

  assert.equal(calls.length, 1);
});

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getLiveWindowWebContents,
  renderLoadinglineBridge,
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

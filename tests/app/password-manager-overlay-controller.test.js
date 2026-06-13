const test = require("node:test");
const assert = require("node:assert/strict");
const EventEmitter = require("node:events");

const {
  createPasswordManagerOverlayController,
  centerBounds,
} = require("../../ui/shell/services/passwordManagerOverlayController");
const {
  SURFACE_ROLES,
  markSurfaceRole,
  getSurfaceRole,
} = require("../../core/security/surfaceTrust");

class FakeWebContents extends EventEmitter {
  constructor() {
    super();
    this.executeJavaScriptResult = Promise.resolve(true);
    this.executeJavaScriptResults = [];
    this.executeJavaScriptCalls = [];
  }

  isDestroyed() {
    return false;
  }

  executeJavaScript(script) {
    this.executeJavaScriptCalls.push(script);
    if (this.executeJavaScriptResults.length > 0) {
      return Promise.resolve(this.executeJavaScriptResults.shift());
    }
    return this.executeJavaScriptResult;
  }
}

class FakeWindow extends EventEmitter {
  constructor(bounds) {
    super();
    this.bounds = { ...bounds };
    this.webContents = new FakeWebContents();
    this.destroyed = false;
    this.shown = false;
    this.closed = false;
    this.opacityValues = [];
    this.backgroundColor = null;
  }

  isDestroyed() {
    return this.destroyed;
  }

  getBounds() {
    return { ...this.bounds };
  }

  getContentBounds() {
    return { ...this.bounds };
  }

  setBounds(bounds) {
    this.bounds = { ...this.bounds, ...bounds };
  }

  show() {
    this.shown = true;
  }

  setOpacity(value) {
    this.opacityValues.push(value);
  }

  setBackgroundColor(value) {
    this.backgroundColor = value;
  }

  close() {
    this.closed = true;
    this.emit("closed");
  }
}

class FakePopup extends EventEmitter {
  constructor(browserWindow) {
    super();
    this.browserWindow = browserWindow;
    this.destroyed = false;
  }

  isDestroyed() {
    return this.destroyed;
  }

  destroy() {
    this.destroyed = true;
    this.browserWindow.emit("closed");
  }
}

test("centerBounds centers popup inside parent", () => {
  assert.deepEqual(
    centerBounds(
      { x: 100, y: 50, width: 1000, height: 800 },
      { x: 0, y: 0, width: 400, height: 500 },
    ),
    { x: 400, y: 200, width: 400, height: 500 },
  );
});

test("password manager overlay centers popup and marks extension role", () => {
  const parent = new FakeWindow({ x: 100, y: 50, width: 1000, height: 800 });
  const popupWindow = new FakeWindow({ x: 0, y: 0, width: 400, height: 500 });
  const popup = new FakePopup(popupWindow);
  const controller = createPasswordManagerOverlayController({
    getParentWindow: () => parent,
    markSurfaceRole,
    extensionRole: SURFACE_ROLES.EXTENSION,
  });

  assert.equal(controller.handlePopupCreated(popup), true);
  assert.deepEqual(popupWindow.getBounds(), {
    x: 400,
    y: 200,
    width: 400,
    height: 500,
  });
  assert.equal(popupWindow.shown, false);
  assert.deepEqual(popupWindow.opacityValues, [0]);
  assert.equal(getSurfaceRole(popupWindow.webContents), SURFACE_ROLES.EXTENSION);
});

test("password manager overlay uses active theme background while hidden", () => {
  const parent = new FakeWindow({ x: 0, y: 0, width: 800, height: 600 });
  const popupWindow = new FakeWindow({ x: 0, y: 0, width: 300, height: 300 });
  const popup = new FakePopup(popupWindow);
  const controller = createPasswordManagerOverlayController({
    getParentWindow: () => parent,
    getTheme: () => ({ elevatedBackground: "#223344" }),
  });

  controller.handlePopupCreated(popup);

  assert.equal(popupWindow.backgroundColor, "#223344");
  assert.deepEqual(popupWindow.opacityValues, [0]);
  controller.close({ restoreFocus: false });
});

test("password manager overlay reveals after popup content paints", async () => {
  const parent = new FakeWindow({ x: 0, y: 0, width: 800, height: 600 });
  const popupWindow = new FakeWindow({ x: 0, y: 0, width: 300, height: 300 });
  const popup = new FakePopup(popupWindow);
  let resolvePaint;
  popupWindow.webContents.executeJavaScriptResults = [
    Promise.resolve(true),
    new Promise((resolve) => {
      resolvePaint = resolve;
    }),
    Promise.resolve(true),
  ];
  const controller = createPasswordManagerOverlayController({
    getParentWindow: () => parent,
  });

  controller.handlePopupCreated(popup);
  popupWindow.webContents.emit("did-finish-load");
  assert.deepEqual(popupWindow.opacityValues, [0]);

  resolvePaint(true);
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(popupWindow.opacityValues, [0, 1]);
  assert.match(
    popupWindow.webContents.executeJavaScriptCalls[0],
    /noctra-password-manager-popup-cover/,
  );
  assert.match(popupWindow.webContents.executeJavaScriptCalls[2], /cover\.remove/);
  controller.close({ restoreFocus: false });
});

test("password manager overlay keeps cover when content is not visually ready", async () => {
  const parent = new FakeWindow({ x: 0, y: 0, width: 800, height: 600 });
  const popupWindow = new FakeWindow({ x: 0, y: 0, width: 300, height: 300 });
  const popup = new FakePopup(popupWindow);
  popupWindow.webContents.executeJavaScriptResults = [true, false];
  const controller = createPasswordManagerOverlayController({
    getParentWindow: () => parent,
  });

  controller.handlePopupCreated(popup);
  popupWindow.webContents.emit("dom-ready");
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(popupWindow.opacityValues, [0, 1]);
  assert.match(
    popupWindow.webContents.executeJavaScriptCalls[1],
    /hasVisibleContent/,
  );
  assert.match(
    popupWindow.webContents.executeJavaScriptCalls[1],
    /waitForStableLayout/,
  );
  assert.equal(popupWindow.webContents.executeJavaScriptCalls.length, 2);
  controller.close({ restoreFocus: false });
});

test("password manager overlay visual-readiness gate waits for fonts", async () => {
  const parent = new FakeWindow({ x: 0, y: 0, width: 800, height: 600 });
  const popupWindow = new FakeWindow({ x: 0, y: 0, width: 300, height: 300 });
  const popup = new FakePopup(popupWindow);
  popupWindow.webContents.executeJavaScriptResults = [true, true, true];
  const controller = createPasswordManagerOverlayController({
    getParentWindow: () => parent,
  });

  controller.handlePopupCreated(popup);
  popupWindow.webContents.emit("did-finish-load");
  await new Promise((resolve) => setImmediate(resolve));

  assert.match(popupWindow.webContents.executeJavaScriptCalls[1], /document\.fonts/);
  assert.deepEqual(popupWindow.opacityValues, [0, 1]);
  controller.close({ restoreFocus: false });
});

test("password manager overlay fallback reveals without content signal", async () => {
  const parent = new FakeWindow({ x: 0, y: 0, width: 800, height: 600 });
  const popupWindow = new FakeWindow({ x: 0, y: 0, width: 300, height: 300 });
  const popup = new FakePopup(popupWindow);
  const controller = createPasswordManagerOverlayController({
    getParentWindow: () => parent,
  });

  controller.handlePopupCreated(popup);
  controller.scheduleRevealFallback(0);
  await new Promise((resolve) => setTimeout(resolve, 1));

  assert.deepEqual(popupWindow.opacityValues, [0, 1]);
  assert.match(popupWindow.webContents.executeJavaScriptCalls.at(-1), /cover\.remove/);
  controller.close({ restoreFocus: false });
});

test("password manager overlay recenters on popup resize and parent resize", () => {
  const parent = new FakeWindow({ x: 0, y: 0, width: 800, height: 600 });
  const popupWindow = new FakeWindow({ x: 0, y: 0, width: 300, height: 300 });
  const popup = new FakePopup(popupWindow);
  const controller = createPasswordManagerOverlayController({
    getParentWindow: () => parent,
  });

  controller.handlePopupCreated(popup);
  assert.deepEqual(popupWindow.getBounds(), {
    x: 250,
    y: 150,
    width: 300,
    height: 300,
  });

  popupWindow.bounds.width = 400;
  popupWindow.bounds.height = 200;
  popup.emit("resized");
  assert.deepEqual(popupWindow.getBounds(), {
    x: 200,
    y: 200,
    width: 400,
    height: 200,
  });

  popupWindow.bounds.x = 15;
  popupWindow.bounds.y = 25;
  popup.emit("moved");
  assert.deepEqual(popupWindow.getBounds(), {
    x: 200,
    y: 200,
    width: 400,
    height: 200,
  });

  parent.bounds.width = 1000;
  parent.emit("resize");
  assert.deepEqual(popupWindow.getBounds(), {
    x: 300,
    y: 200,
    width: 400,
    height: 200,
  });
});

test("password manager overlay recenters after popup load moves window", () => {
  const parent = new FakeWindow({ x: 10, y: 20, width: 900, height: 700 });
  const popupWindow = new FakeWindow({ x: 0, y: 0, width: 320, height: 520 });
  const popup = new FakePopup(popupWindow);
  const controller = createPasswordManagerOverlayController({
    getParentWindow: () => parent,
  });

  controller.handlePopupCreated(popup);
  popupWindow.bounds.x = 0;
  popupWindow.bounds.y = 90;
  popupWindow.webContents.emit("did-finish-load");

  assert.deepEqual(popupWindow.getBounds(), {
    x: 300,
    y: 110,
    width: 320,
    height: 520,
  });
  controller.close({ restoreFocus: false });
});

test("password manager overlay closes on Escape and restores focus", () => {
  const parent = new FakeWindow({ x: 0, y: 0, width: 800, height: 600 });
  const popupWindow = new FakeWindow({ x: 0, y: 0, width: 300, height: 300 });
  const popup = new FakePopup(popupWindow);
  let focusCount = 0;
  const controller = createPasswordManagerOverlayController({
    getParentWindow: () => parent,
    focusActiveEditorSurface: () => {
      focusCount += 1;
    },
  });

  controller.handlePopupCreated(popup);
  popupWindow.webContents.emit("before-input-event", {}, { key: "Escape" });

  assert.equal(popup.destroyed, true);
  assert.equal(focusCount, 1);
});

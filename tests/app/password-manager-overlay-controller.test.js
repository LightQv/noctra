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
  isDestroyed() {
    return false;
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
  }

  isDestroyed() {
    return this.destroyed;
  }

  getBounds() {
    return { ...this.bounds };
  }

  setBounds(bounds) {
    this.bounds = { ...this.bounds, ...bounds };
  }

  show() {
    this.shown = true;
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
  assert.equal(popupWindow.shown, true);
  assert.equal(getSurfaceRole(popupWindow.webContents), SURFACE_ROLES.EXTENSION);
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

  parent.bounds.width = 1000;
  parent.emit("resize");
  assert.deepEqual(popupWindow.getBounds(), {
    x: 300,
    y: 200,
    width: 400,
    height: 200,
  });
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

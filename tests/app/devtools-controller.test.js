const test = require("node:test");
const assert = require("node:assert/strict");

const {
  syncDevtoolsTargetToLeftBuffer,
} = require("../../browser/services/devtoolsController");

function createView(id) {
  return {
    id,
    bounds: null,
    webContents: {
      id: `${id}-webContents`,
      isDestroyed: () => false,
      destroy() {},
    },
  };
}

function createBuffer(id, view = null, ratio = null) {
  return {
    id,
    devtoolsSplitOpen: Boolean(view),
    devtoolsView: view,
    devtoolsSplitRatio: ratio,
    webContents: {
      isDestroyed: () => false,
      setDevToolsWebContents() {},
      openDevTools() {},
      isDevToolsOpened: () => false,
    },
  };
}

function createManager(buffers, activeIndex) {
  const attached = [];
  return {
    buffers,
    activeIndex,
    split: { enabled: true, mode: "devtools", ratio: 0.25 },
    focusedPane: "left",
    devtoolsView: buffers[activeIndex].devtoolsView,
    devtoolsTarget: buffers[activeIndex].webContents,
    window: {
      addBrowserView(view) {
        if (!attached.includes(view)) attached.push(view);
      },
      removeBrowserView(view) {
        const index = attached.indexOf(view);
        if (index >= 0) attached.splice(index, 1);
      },
      getBrowserViews() {
        return attached.slice();
      },
    },
    getLeftBuffer() {
      return this.buffers[this.activeIndex] || null;
    },
    getAttached() {
      return attached.slice();
    },
  };
}

test("devtools split hides on tab without devtools and restores on owner", () => {
  const firstView = createView("first-devtools");
  const first = createBuffer(1, firstView, 0.25);
  const second = createBuffer(2);
  const manager = createManager([first, second], 0);
  manager.window.addBrowserView(firstView);

  manager.activeIndex = 1;
  syncDevtoolsTargetToLeftBuffer(manager);

  assert.equal(manager.split.enabled, false);
  assert.equal(manager.split.mode, "regular");
  assert.deepEqual(manager.getAttached(), []);

  manager.activeIndex = 0;
  syncDevtoolsTargetToLeftBuffer(manager);

  assert.equal(manager.split.enabled, true);
  assert.equal(manager.split.mode, "devtools");
  assert.equal(manager.split.ratio, 0.25);
  assert.deepEqual(manager.getAttached(), [firstView]);
});

test("devtools split restores each tab ratio independently", () => {
  const firstView = createView("first-devtools");
  const secondView = createView("second-devtools");
  const first = createBuffer(1, firstView, 0.25);
  const second = createBuffer(2, secondView, 0.35);
  const manager = createManager([first, second], 0);
  manager.window.addBrowserView(firstView);

  manager.activeIndex = 1;
  syncDevtoolsTargetToLeftBuffer(manager);

  assert.equal(manager.split.enabled, true);
  assert.equal(manager.split.mode, "devtools");
  assert.equal(manager.split.ratio, 0.35);
  assert.deepEqual(manager.getAttached(), [secondView]);

  manager.activeIndex = 0;
  syncDevtoolsTargetToLeftBuffer(manager);

  assert.equal(manager.split.enabled, true);
  assert.equal(manager.split.mode, "devtools");
  assert.equal(manager.split.ratio, 0.25);
  assert.deepEqual(manager.getAttached(), [firstView]);
});

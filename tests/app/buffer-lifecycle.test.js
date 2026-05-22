const test = require("node:test");
const assert = require("node:assert/strict");

const {
  closeAllLeftOf,
  closeAllRightOf,
} = require("../../browser/services/bufferLifecycleService");

function makeMockBuffer(tag) {
  return {
    id: 0,
    tag,
    view: { tag: `view-${tag}` },
    destroy() {},
    load() {},
    on() {},
    setContentUiOptions() {},
  };
}

function makeMockManager(buffers = [], activeIndex = -1) {
  const notifications = [];
  return {
    buffers: buffers.slice(),
    activeIndex,
    window: { isDestroyed: () => false },
    split: { rightPaneSourceBuffer: null, enabled: false, mode: "regular" },
    focusedPane: "left",
    closedBuffers: [],
    maxClosedBuffers: 50,
    lastSelectionCopyByWebContentsId: new Map(),
    contentUiOptions: {},
    reindexBuffers() {
      for (let i = 0; i < this.buffers.length; i += 1) {
        this.buffers[i].id = i + 1;
      }
    },
    reconcileSplitSources() {},
    syncDevtoolsTargetToLeftBuffer() {},
    layoutViews() {},
    focusActive() {},
    getActive() {
      if (this.activeIndex < 0 || this.activeIndex >= this.buffers.length) {
        return null;
      }
      return this.buffers[this.activeIndex];
    },
    notify(event) {
      notifications.push(event);
    },
    getNotifications() {
      return notifications;
    },
    attachPaneTracking() {},
  };
}

test("closeAllLeftOf keeps activeIndex correct when active is to the right", () => {
  const b1 = makeMockBuffer("a");
  const b2 = makeMockBuffer("b");
  const b3 = makeMockBuffer("c");
  const b4 = makeMockBuffer("d");
  const manager = makeMockManager([b1, b2, b3, b4], 2); // active = b3 (index 2)
  // Close all left of index 1 (b2)
  closeAllLeftOf(manager, 1);
  assert.equal(manager.buffers.length, 3);
  assert.equal(manager.activeIndex, 1); // was 2, removed 1 from left -> 1
  assert.equal(manager.getActive().tag, "c");
});

test("closeAllLeftOf resets activeIndex when active is to the left", () => {
  const b1 = makeMockBuffer("a");
  const b2 = makeMockBuffer("b");
  const b3 = makeMockBuffer("c");
  const b4 = makeMockBuffer("d");
  const manager = makeMockManager([b1, b2, b3, b4], 0); // active = b1 (index 0)
  // Close all left of index 2 (b3)
  closeAllLeftOf(manager, 2);
  assert.equal(manager.buffers.length, 2);
  assert.equal(manager.activeIndex, 0); // active was removed, reset to 0
  assert.equal(manager.getActive().tag, "c");
});

test("closeAllRightOf keeps activeIndex correct when active is to the left", () => {
  const b1 = makeMockBuffer("a");
  const b2 = makeMockBuffer("b");
  const b3 = makeMockBuffer("c");
  const b4 = makeMockBuffer("d");
  const manager = makeMockManager([b1, b2, b3, b4], 1); // active = b2 (index 1)
  // Close all right of index 2 (b3)
  closeAllRightOf(manager, 2);
  assert.equal(manager.buffers.length, 3);
  assert.equal(manager.activeIndex, 1); // active survived, unchanged
  assert.equal(manager.getActive().tag, "b");
});

test("closeAllRightOf sets activeIndex to clicked tab when active is to the right", () => {
  const b1 = makeMockBuffer("a");
  const b2 = makeMockBuffer("b");
  const b3 = makeMockBuffer("c");
  const b4 = makeMockBuffer("d");
  const manager = makeMockManager([b1, b2, b3, b4], 3); // active = b4 (index 3)
  // Close all right of index 1 (b2)
  closeAllRightOf(manager, 1);
  assert.equal(manager.buffers.length, 2);
  assert.equal(manager.activeIndex, 1); // active removed, set to clicked index
  assert.equal(manager.getActive().tag, "b");
});

test("closeAllLeftOf handles edge case at index 0", () => {
  const b1 = makeMockBuffer("a");
  const b2 = makeMockBuffer("b");
  const manager = makeMockManager([b1, b2], 1);
  closeAllLeftOf(manager, 0);
  assert.equal(manager.buffers.length, 2);
  assert.equal(manager.activeIndex, 1);
});

test("closeAllRightOf handles edge case at last index", () => {
  const b1 = makeMockBuffer("a");
  const b2 = makeMockBuffer("b");
  const manager = makeMockManager([b1, b2], 0);
  closeAllRightOf(manager, 1);
  assert.equal(manager.buffers.length, 2);
  assert.equal(manager.activeIndex, 0);
});

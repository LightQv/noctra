const test = require("node:test");
const assert = require("node:assert/strict");

const {
  exportSessionSnapshot,
  isSessionRestorableBuffer,
  restoreSessionSnapshot,
} = require("../../browser/services/sessionSnapshotService");

function makeBuffer(id, url) {
  return {
    id,
    kind: "web",
    url,
    view: { id: `view-${id}` },
    destroyed: false,
    destroy() {
      this.destroyed = true;
    },
  };
}

function makeManager(buffers = []) {
  return {
    buffers,
    window: { id: 1 },
    split: { enabled: false },
    activeIndex: 0,
    closedBuffers: [],
    focusedPane: "left",
    created: [],
    focused: false,
    notified: null,
    closeRightSplit() {},
    reindexBuffers() {},
    layoutViews() {},
    focusActive() {
      this.focused = true;
    },
    notify(change) {
      this.notified = change;
    },
    create(url, options) {
      this.created.push({ url, options });
      const buffer = makeBuffer(this.buffers.length + 1, url);
      this.buffers.push(buffer);
      return buffer;
    },
    getFocusedMainBuffer() {
      return this.buffers[this.activeIndex] || null;
    },
    getLeftBuffer() {
      return this.buffers[0] || null;
    },
  };
}

test("session snapshot excludes extension internal URLs", () => {
  const http = makeBuffer(1, "https://example.com");
  const chromeExtension = makeBuffer(2, "chrome-extension://abc/popup.html");
  const crx = makeBuffer(3, "crx://abc/index.html");
  const manager = makeManager([http, chromeExtension, crx]);

  assert.equal(isSessionRestorableBuffer(manager, http), true);
  assert.equal(isSessionRestorableBuffer(manager, chromeExtension), false);
  assert.equal(isSessionRestorableBuffer(manager, crx), false);

  const snapshot = exportSessionSnapshot(manager);

  assert.deepEqual(snapshot.buffers, [{ url: "https://example.com" }]);
});

test("session restore skips extension internal URLs", () => {
  const existing = makeBuffer(1, "https://old.example");
  const manager = makeManager([existing]);

  const restored = restoreSessionSnapshot(manager, {
    activeIndex: 2,
    buffers: [
      { url: "chrome-extension://abc/popup.html" },
      { url: "crx://abc/index.html" },
      { url: "https://example.com" },
    ],
  });

  assert.equal(restored, true);
  assert.equal(existing.destroyed, true);
  assert.deepEqual(manager.created, [
    { url: "https://example.com", options: { activate: false } },
  ]);
  assert.equal(manager.activeIndex, 0);
  assert.equal(manager.focused, true);
});

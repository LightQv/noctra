const test = require("node:test");
const assert = require("node:assert/strict");

const { registerWebContextMenu } = require("../../runtime/contextMenuRegistration");

function makeMockWebContents(id) {
  const listeners = new Map();
  const onceListeners = new Map();
  let destroyed = false;

  return {
    id,
    isDestroyed() {
      return destroyed;
    },
    destroy() {
      destroyed = true;
    },
    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(handler);
    },
    once(event, handler) {
      if (!onceListeners.has(event)) onceListeners.set(event, []);
      onceListeners.get(event).push(handler);
    },
    removeListener(event, handler) {
      const list = listeners.get(event) || [];
      const index = list.indexOf(handler);
      if (index >= 0) list.splice(index, 1);
    },
    emit(event, ...args) {
      (listeners.get(event) || []).forEach((h) => h(...args));
      (onceListeners.get(event) || []).forEach((h) => h(...args));
      onceListeners.delete(event);
    },
    navigationHistory: {
      canGoBack: () => false,
      canGoForward: () => false,
    },
    executeJavaScript() {
      return Promise.resolve();
    },
    getListenerCount(event) {
      return (listeners.get(event) || []).length;
    },
  };
}

function makeMockBuffer(id, options = {}) {
  const wc = makeMockWebContents(id);
  return {
    id,
    webContents: wc,
    isEditable: options.isEditable || false,
    url: options.url || "about:blank",
  };
}

function makeMockBuffers(buffersArray = []) {
  const buffers = buffersArray.slice();
  const subscribers = new Set();

  return {
    buffers,
    split: {
      rightPaneBuffer: null,
      enabled: false,
      mode: "regular",
    },
    getBuffers() {
      return buffers.slice();
    },
    getRightPaneBuffer() {
      return this.split.rightPaneBuffer;
    },
    isSplitEnabled() {
      return this.split.enabled;
    },
    getBufferByWebContents(webContents) {
      return buffers.find((b) => b.webContents === webContents) || null;
    },
    subscribe(listener) {
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    },
    notifySubscribers() {
      for (const listener of subscribers) {
        listener();
      }
    },
  };
}

test("registration attaches context-menu listener to all existing buffers", () => {
  const b1 = makeMockBuffer(1);
  const b2 = makeMockBuffer(2);
  const buffers = makeMockBuffers([b1, b2]);

  registerWebContextMenu({
    win: {},
    buffers,
    configService: { getConfigValue: () => "duckduckgo" },
    dispatch: () => {},
    state: {},
    INTENTS: {},
    validateNavigableUrl: () => ({ ok: true }),
    isBookmarkableBuffer: () => false,
    clipboard: {},
    dialog: {},
  });

  assert.equal(b1.webContents.getListenerCount("context-menu"), 1);
  assert.equal(b2.webContents.getListenerCount("context-menu"), 1);
});

test("registration skips editable buffers", () => {
  const b1 = makeMockBuffer(1, { isEditable: true });
  const b2 = makeMockBuffer(2, { isEditable: false });
  const buffers = makeMockBuffers([b1, b2]);

  registerWebContextMenu({
    win: {},
    buffers,
    configService: { getConfigValue: () => "duckduckgo" },
    dispatch: () => {},
    state: {},
    INTENTS: {},
    validateNavigableUrl: () => ({ ok: true }),
    isBookmarkableBuffer: () => false,
    clipboard: {},
    dialog: {},
  });

  assert.equal(b1.webContents.getListenerCount("context-menu"), 0, "editable buffer must not get listener");
  assert.equal(b2.webContents.getListenerCount("context-menu"), 1, "non-editable buffer must get listener");
});

test("registration attaches listener to right pane buffer when split active", () => {
  const b1 = makeMockBuffer(1);
  const rightPane = makeMockBuffer(99);
  const buffers = makeMockBuffers([b1]);
  buffers.split.rightPaneBuffer = rightPane;
  buffers.split.enabled = true;

  registerWebContextMenu({
    win: {},
    buffers,
    configService: { getConfigValue: () => "duckduckgo" },
    dispatch: () => {},
    state: {},
    INTENTS: {},
    validateNavigableUrl: () => ({ ok: true }),
    isBookmarkableBuffer: () => false,
    clipboard: {},
    dialog: {},
  });

  assert.equal(b1.webContents.getListenerCount("context-menu"), 1);
  assert.equal(rightPane.webContents.getListenerCount("context-menu"), 1);
});

test("subscribe callback attaches listeners to new buffers", () => {
  const buffers = makeMockBuffers([]);

  registerWebContextMenu({
    win: {},
    buffers,
    configService: { getConfigValue: () => "duckduckgo" },
    dispatch: () => {},
    state: {},
    INTENTS: {},
    validateNavigableUrl: () => ({ ok: true }),
    isBookmarkableBuffer: () => false,
    clipboard: {},
    dialog: {},
  });

  const b1 = makeMockBuffer(1);
  buffers.buffers.push(b1);
  buffers.notifySubscribers();

  assert.equal(b1.webContents.getListenerCount("context-menu"), 1);
});

test("subscribe callback removes listeners from removed buffers", () => {
  const b1 = makeMockBuffer(1);
  const b2 = makeMockBuffer(2);
  const buffers = makeMockBuffers([b1, b2]);

  registerWebContextMenu({
    win: {},
    buffers,
    configService: { getConfigValue: () => "duckduckgo" },
    dispatch: () => {},
    state: {},
    INTENTS: {},
    validateNavigableUrl: () => ({ ok: true }),
    isBookmarkableBuffer: () => false,
    clipboard: {},
    dialog: {},
  });

  assert.equal(b1.webContents.getListenerCount("context-menu"), 1);

  buffers.buffers.splice(0, 1); // remove b1
  buffers.notifySubscribers();

  assert.equal(b1.webContents.getListenerCount("context-menu"), 0, "removed buffer listener must be cleaned up");
  assert.equal(b2.webContents.getListenerCount("context-menu"), 1, "remaining buffer keeps listener");
});

test("cleanup function removes all listeners and unsubscribes", () => {
  const b1 = makeMockBuffer(1);
  const buffers = makeMockBuffers([b1]);

  const cleanup = registerWebContextMenu({
    win: {},
    buffers,
    configService: { getConfigValue: () => "duckduckgo" },
    dispatch: () => {},
    state: {},
    INTENTS: {},
    validateNavigableUrl: () => ({ ok: true }),
    isBookmarkableBuffer: () => false,
    clipboard: {},
    dialog: {},
  });

  assert.equal(b1.webContents.getListenerCount("context-menu"), 1);

  cleanup();

  assert.equal(b1.webContents.getListenerCount("context-menu"), 0, "cleanup must remove all listeners");
});

test("registration handles destroyed webContents gracefully on attach", () => {
  const b1 = makeMockBuffer(1);
  b1.webContents.destroy();

  const buffers = makeMockBuffers([b1]);

  assert.doesNotThrow(() => {
    registerWebContextMenu({
      win: {},
      buffers,
      configService: { getConfigValue: () => "duckduckgo" },
      dispatch: () => {},
      state: {},
      INTENTS: {},
      validateNavigableUrl: () => ({ ok: true }),
      isBookmarkableBuffer: () => false,
      clipboard: {},
      dialog: {},
    });
  });

  assert.equal(b1.webContents.getListenerCount("context-menu"), 0);
});

test("registration deduplicates listeners for same webContents", () => {
  const b1 = makeMockBuffer(1);
  const buffers = makeMockBuffers([b1]);

  registerWebContextMenu({
    win: {},
    buffers,
    configService: { getConfigValue: () => "duckduckgo" },
    dispatch: () => {},
    state: {},
    INTENTS: {},
    validateNavigableUrl: () => ({ ok: true }),
    isBookmarkableBuffer: () => false,
    clipboard: {},
    dialog: {},
  });

  buffers.notifySubscribers();
  buffers.notifySubscribers();

  assert.equal(b1.webContents.getListenerCount("context-menu"), 1, "must not duplicate listeners on repeated subscribe callbacks");
});

const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");

const {
  ensureSearchRuntime,
  clearSearchRuntimeReady,
  searchRuntimeStart,
  searchRuntimeClear,
  sendSearchRuntimeCommand,
} = require("../../core/adapters/platform/webContentsActions");

function createWebContentsStub() {
  const listeners = new Map();
  class MutationObserverStub {
    constructor(callback) {
      this.callback = callback;
    }
    observe() {}
    disconnect() {}
  }
  const context = {
    window: {
      addEventListener() {},
    },
    document: {
      documentElement: { style: { setProperty() {} } },
      body: {
        appendChild() {},
      },
      createElement() {
        return {
          style: { setProperty() {} },
          setAttribute() {},
          appendChild() {},
        };
      },
    },
    setTimeout,
    Date,
    MutationObserver: MutationObserverStub,
  };
  const calls = [];

  return {
    listeners,
    calls,
    webContents: {
      isDestroyed() {
        return false;
      },
      on(eventName, listener) {
        listeners.set(eventName, listener);
      },
      executeJavaScript(script) {
        calls.push(script);
        return Promise.resolve(vm.runInNewContext(script, context));
      },
    },
  };
}

function createWebContentsWithoutBody() {
  const context = {
    window: {
      addEventListener() {},
    },
    document: {
      documentElement: { style: { setProperty() {} } },
      createElement() {
        return {
          style: { setProperty() {} },
          setAttribute() {},
          appendChild() {},
        };
      },
    },
    setTimeout,
    Date,
  };

  return {
    webContents: {
      isDestroyed() {
        return false;
      },
      on() {},
      executeJavaScript(script) {
        return Promise.resolve(vm.runInNewContext(script, context));
      },
    },
  };
}

test("search runtime bootstrap caches readiness per webContents", async () => {
  const { webContents, calls } = createWebContentsStub();

  const first = await ensureSearchRuntime(webContents);
  const second = await ensureSearchRuntime(webContents);

  assert.equal(first, true);
  assert.equal(second, true);
  assert.equal(calls.length, 1);

  clearSearchRuntimeReady(webContents);
  const third = await ensureSearchRuntime(webContents);
  assert.equal(third, true);
  assert.equal(calls.length, 2);
});

test("search runtime lifecycle clears readiness on navigation", async () => {
  const { webContents, listeners, calls } = createWebContentsStub();

  await ensureSearchRuntime(webContents);
  assert.equal(calls.length, 1);
  assert.equal(typeof listeners.get("did-start-navigation"), "function");

  listeners.get("did-start-navigation")();

  await ensureSearchRuntime(webContents);
  assert.equal(calls.length, 2);
});

test("search runtime start and clear roundtrip returns structured response", async () => {
  const { webContents } = createWebContentsStub();

  const startResult = await searchRuntimeStart(webContents, "hello");
  assert.equal(startResult.ok, true);
  assert.equal(typeof startResult.requestId, "string");
  assert.equal(startResult.payload.activeIndex, 0);
  assert.equal(startResult.payload.total, 0);

  const clearResult = await searchRuntimeClear(webContents);
  assert.equal(clearResult.ok, true);
  assert.equal(clearResult.payload.activeIndex, 0);
  assert.equal(clearResult.payload.total, 0);
});

test("search runtime applies match cap and binds performance observers", async () => {
  const { webContents } = createWebContentsStub();

  const startResult = await searchRuntimeStart(webContents, "x".repeat(20));
  assert.equal(startResult.ok, true);
  assert.equal(startResult.payload.total, 0);

  const debug = await sendSearchRuntimeCommand(webContents, "debug-state", {});
  assert.equal(debug.ok, true);
  assert.equal(typeof debug.payload.hasOverlay, "boolean");
});

test("search runtime hint open/input gracefully handle zero matches", async () => {
  const { webContents } = createWebContentsStub();

  await searchRuntimeStart(webContents, "hello");
  const hints = await sendSearchRuntimeCommand(webContents, "hint-open", {});
  assert.equal(hints.ok, true);
  assert.equal(hints.payload.visibleHintCount, 0);

  const jump = await sendSearchRuntimeCommand(webContents, "hint-input", {
    input: "a",
  });
  assert.equal(jump.ok, true);
  assert.equal(jump.payload.activeIndex, 0);
  assert.equal(jump.payload.visibleHintCount, 0);
});

test("search runtime start handles missing document.body without throwing", async () => {
  const { webContents } = createWebContentsWithoutBody();

  const startResult = await searchRuntimeStart(webContents, "hello");
  assert.equal(startResult.ok, true);
  assert.equal(startResult.payload.total, 0);
  assert.equal(startResult.payload.activeIndex, 0);
});

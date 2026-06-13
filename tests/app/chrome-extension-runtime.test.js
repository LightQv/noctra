const test = require("node:test");
const assert = require("node:assert/strict");
const EventEmitter = require("node:events");

const {
  ChromeExtensionRuntime,
  NoopChromeExtensionRuntime,
  createChromeExtensionRuntime,
  isRegisterableBuffer,
  resolveExtensionCreatedUrl,
} = require("../../core/extensions/chromeExtensionRuntime");

function makeWebContents(id) {
  return {
    id,
    isDestroyed: () => false,
  };
}

function makeBuffer(id, tag, options = {}) {
  return {
    id,
    tag,
    kind: options.kind || "web",
    isEditable: Boolean(options.isEditable),
    title: options.title || tag,
    url: options.url || "about:blank",
    webContents: options.webContents || makeWebContents(id),
  };
}

function makeBufferManager(initialBuffers = []) {
  const manager = {
    buffers: initialBuffers.slice(),
    activeId: initialBuffers[0]?.id || null,
    created: [],
    closed: [],
    switched: [],
    create(url, options = {}) {
      const buffer = makeBuffer(this.buffers.length + 1, `created-${url}`, {
        url,
      });
      this.buffers.push(buffer);
      this.created.push({ url, options, buffer });
      if (options.activate !== false) {
        this.activeId = buffer.id;
      }
      return buffer;
    },
    switchTo(id) {
      this.activeId = id;
      this.switched.push(id);
      return this.getActive();
    },
    close(id) {
      this.closed.push(id);
      this.buffers = this.buffers.filter((buffer) => buffer.id !== id);
      if (this.activeId === id) {
        this.activeId = this.buffers[0]?.id || null;
      }
      return this.getActive();
    },
    getActive() {
      return this.buffers.find((buffer) => buffer.id === this.activeId) || null;
    },
    getBufferByWebContents(webContents) {
      return (
        this.buffers.find((buffer) => buffer.webContents === webContents) || null
      );
    },
  };

  return manager;
}

function makeFakeExtensionRuntimeClass(calls) {
  return class FakeExtensionRuntime {
    static handleCRXProtocol(session) {
      calls.handleCRXProtocol.push(session);
    }

    constructor(options) {
      calls.constructorOptions.push(options);
      this.options = options;
    }

    addTab(webContents, browserWindow) {
      calls.addTab.push({ webContents, browserWindow });
    }

    selectTab(webContents) {
      calls.selectTab.push(webContents);
    }

    getContextMenuItems(webContents, params) {
      calls.getContextMenuItems.push({ webContents, params });
      return ["extension-item"];
    }
  };
}

function makeCalls() {
  return {
    handleCRXProtocol: [],
    constructorOptions: [],
    addTab: [],
    selectTab: [],
    getContextMenuItems: [],
    activateClick: [],
  };
}

test("createChromeExtensionRuntime returns no-op runtime without package class", () => {
  const runtime = createChromeExtensionRuntime();

  assert.ok(runtime instanceof NoopChromeExtensionRuntime);
  assert.equal(runtime.enabled, false);
  assert.equal(runtime.registerBuffer(), false);
  assert.deepEqual(runtime.getContextMenuItems(), []);
});

test("createChromeExtensionRuntime returns no-op when package constructor fails", () => {
  const notifications = [];
  class ThrowingExtensionRuntime {
    constructor() {
      throw new Error("missing license");
    }
  }

  const runtime = createChromeExtensionRuntime({
    ExtensionRuntimeClass: ThrowingExtensionRuntime,
    bufferManager: makeBufferManager([]),
    getBrowserWindow: () => ({}),
    notificationsService: {
      notify(entry) {
        notifications.push(entry);
      },
    },
  });

  assert.ok(runtime instanceof NoopChromeExtensionRuntime);
  assert.equal(runtime.enabled, false);
  assert.equal(notifications.at(-1).code, "chrome_extension_runtime_unavailable");
});

test("chrome extension runtime registers and selects buffers", () => {
  const calls = makeCalls();
  const session = { name: "defaultSession" };
  const browserWindow = { id: 1 };
  const buffer = makeBuffer(1, "one", { url: "https://example.test" });
  const manager = makeBufferManager([buffer]);
  const runtime = new ChromeExtensionRuntime({
    ExtensionRuntimeClass: makeFakeExtensionRuntimeClass(calls),
    session,
    bufferManager: manager,
    getBrowserWindow: () => browserWindow,
    license: "GPL-3.0",
  });

  assert.equal(runtime.enabled, true);
  assert.equal(runtime.registerBuffer(buffer), true);
  assert.equal(runtime.selectBuffer(buffer), true);
  assert.deepEqual(calls.handleCRXProtocol, [session]);
  assert.equal(calls.constructorOptions[0].session, session);
  assert.equal(calls.constructorOptions[0].license, "GPL-3.0");
  assert.equal(calls.addTab.length, 2);
  assert.equal(calls.addTab[0].webContents, buffer.webContents);
  assert.equal(calls.addTab[0].browserWindow, browserWindow);
  assert.deepEqual(calls.selectTab, [buffer.webContents]);
});

test("chrome extension runtime forwards action popup created events", () => {
  const popup = { id: "popup" };
  const calls = makeCalls();
  const seen = [];
  class FakeExtensionRuntime extends EventEmitter {
    static handleCRXProtocol() {}

    constructor() {
      super();
      process.nextTick(() => this.emit("browser-action-popup-created", popup));
    }
  }

  new ChromeExtensionRuntime({
    ExtensionRuntimeClass: FakeExtensionRuntime,
    session: {},
    bufferManager: makeBufferManager([]),
    getBrowserWindow: () => ({}),
    onActionPopupCreated: (nextPopup) => seen.push(nextPopup),
  });

  return new Promise((resolve) => {
    process.nextTick(() => {
      assert.deepEqual(seen, [popup]);
      assert.deepEqual(calls.activateClick, []);
      resolve();
    });
  });
});

test("chrome extension runtime opens popup through package browser action fallback", () => {
  const calls = makeCalls();
  class FakeExtensionRuntime {
    static handleCRXProtocol() {}

    constructor() {
      this.ctx = {
        store: {
          getActiveTabOfCurrentWindow: () => ({ id: 42 }),
        },
      };
      this.api = {
        browserAction: {
          activateClick(details) {
            calls.activateClick.push(details);
          },
        },
      };
    }
  }

  const runtime = new ChromeExtensionRuntime({
    ExtensionRuntimeClass: FakeExtensionRuntime,
    session: {},
    bufferManager: makeBufferManager([]),
    getBrowserWindow: () => ({ getSize: () => [900, 700] }),
  });

  assert.equal(runtime.openActionPopup("bitwarden"), true);
  assert.equal(calls.activateClick.length, 1);
  assert.equal(calls.activateClick[0].extensionId, "nngceckbapebfimnlniiiahkandclblb");
  assert.equal(calls.activateClick[0].tabId, 42);
});

test("chrome extension runtime skips non-registerable buffers", () => {
  const calls = makeCalls();
  const manager = makeBufferManager();
  const runtime = new ChromeExtensionRuntime({
    ExtensionRuntimeClass: makeFakeExtensionRuntimeClass(calls),
    bufferManager: manager,
    getBrowserWindow: () => ({ id: 1 }),
  });
  const editable = makeBuffer(1, "editable", { isEditable: true });
  const destroyed = makeBuffer(2, "destroyed", {
    webContents: { isDestroyed: () => true },
  });

  assert.equal(isRegisterableBuffer(editable), false);
  assert.equal(isRegisterableBuffer(destroyed), false);
  assert.equal(runtime.registerBuffer(editable), false);
  assert.equal(runtime.registerBuffer(destroyed), false);
  assert.equal(calls.addTab.length, 0);
});

test("extension createTab creates normal Noctra buffer", async () => {
  const calls = makeCalls();
  const browserWindow = { id: 1 };
  const manager = makeBufferManager();
  const runtime = new ChromeExtensionRuntime({
    ExtensionRuntimeClass: makeFakeExtensionRuntimeClass(calls),
    bufferManager: manager,
    getBrowserWindow: () => browserWindow,
  });

  const [webContents, ownerWindow] = await runtime.createTab({
    url: "https://example.test/login",
  });

  assert.equal(manager.created[0].url, "https://example.test/login");
  assert.deepEqual(manager.created[0].options, { activate: true });
  assert.equal(webContents, manager.created[0].buffer.webContents);
  assert.equal(ownerWindow, browserWindow);
  assert.equal(calls.addTab.length, 2);
  assert.deepEqual(calls.selectTab, [webContents]);
});

test("extension createTab falls back to about blank and can stay inactive", async () => {
  const calls = makeCalls();
  const manager = makeBufferManager();
  const runtime = new ChromeExtensionRuntime({
    ExtensionRuntimeClass: makeFakeExtensionRuntimeClass(calls),
    bufferManager: manager,
    getBrowserWindow: () => ({ id: 1 }),
  });

  await runtime.createTab({ active: false });

  assert.equal(manager.created[0].url, "about:blank");
  assert.deepEqual(manager.created[0].options, { activate: false });
  assert.equal(calls.selectTab.length, 0);
});

test("extension createTab blocks extension internals and unsafe URLs", async () => {
  const calls = makeCalls();
  const manager = makeBufferManager();
  const runtime = new ChromeExtensionRuntime({
    ExtensionRuntimeClass: makeFakeExtensionRuntimeClass(calls),
    bufferManager: manager,
    getBrowserWindow: () => ({ id: 1 }),
  });

  await runtime.createTab({ url: "chrome-extension://abc/popup.html" });
  await runtime.createTab({ url: "crx://abc/index.html" });
  await runtime.createTab({ url: "javascript:alert(1)" });

  assert.deepEqual(
    manager.created.map((entry) => entry.url),
    ["about:blank", "about:blank", "about:blank"],
  );
});

test("extension select and remove callbacks map to buffer manager", () => {
  const calls = makeCalls();
  const buffer = makeBuffer(7, "target");
  const manager = makeBufferManager([buffer]);
  const runtime = new ChromeExtensionRuntime({
    ExtensionRuntimeClass: makeFakeExtensionRuntimeClass(calls),
    bufferManager: manager,
    getBrowserWindow: () => ({ id: 1 }),
  });

  assert.equal(runtime.selectTab(buffer.webContents), buffer);
  assert.deepEqual(manager.switched, [7]);

  runtime.removeTab(buffer.webContents);
  assert.deepEqual(manager.closed, [7]);
});

test("extension createWindow opens URL as current-window buffer", async () => {
  const calls = makeCalls();
  const browserWindow = { id: 1 };
  const manager = makeBufferManager();
  const runtime = new ChromeExtensionRuntime({
    ExtensionRuntimeClass: makeFakeExtensionRuntimeClass(calls),
    bufferManager: manager,
    getBrowserWindow: () => browserWindow,
  });

  const ownerWindow = await runtime.createWindow({
    url: ["https://example.test/window"],
  });

  assert.equal(ownerWindow, browserWindow);
  assert.equal(manager.created[0].url, "https://example.test/window");
  assert.deepEqual(calls.selectTab, [manager.created[0].buffer.webContents]);
});

test("extension createWindow blocks extension internal URL", async () => {
  const calls = makeCalls();
  const manager = makeBufferManager();
  const runtime = new ChromeExtensionRuntime({
    ExtensionRuntimeClass: makeFakeExtensionRuntimeClass(calls),
    bufferManager: manager,
    getBrowserWindow: () => ({ id: 1 }),
  });

  await runtime.createWindow({ url: ["chrome-extension://abc/options.html"] });

  assert.equal(manager.created[0].url, "about:blank");
});

test("extension removeWindow warns when app is running", async () => {
  const calls = makeCalls();
  const notifications = [];
  const runtime = new ChromeExtensionRuntime({
    ExtensionRuntimeClass: makeFakeExtensionRuntimeClass(calls),
    bufferManager: makeBufferManager(),
    getBrowserWindow: () => ({ id: 1 }),
    notificationsService: {
      notify(entry) {
        notifications.push(entry);
      },
    },
  });

  await runtime.removeWindow();

  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].code, "extension_window_remove_ignored");
});

test("extension removeWindow is quiet during app quit", async () => {
  const calls = makeCalls();
  const notifications = [];
  const runtime = new ChromeExtensionRuntime({
    ExtensionRuntimeClass: makeFakeExtensionRuntimeClass(calls),
    bufferManager: makeBufferManager(),
    getBrowserWindow: () => ({ id: 1 }),
    isAppQuitting: () => true,
    notificationsService: {
      notify(entry) {
        notifications.push(entry);
      },
    },
  });

  await runtime.removeWindow();

  assert.deepEqual(notifications, []);
});

test("resolveExtensionCreatedUrl allows normal navigable URLs only", () => {
  assert.equal(
    resolveExtensionCreatedUrl("https://example.test/path"),
    "https://example.test/path",
  );
  assert.equal(resolveExtensionCreatedUrl("about:blank"), "about:blank");
  assert.equal(resolveExtensionCreatedUrl("chrome-extension://abc/page.html"), "about:blank");
  assert.equal(resolveExtensionCreatedUrl("file:///tmp/test.html"), "about:blank");
});

test("assignTabDetails adds safe tab metadata", () => {
  const calls = makeCalls();
  const buffer = makeBuffer(1, "active", {
    title: "Active Tab",
    url: "https://example.test",
  });
  const manager = makeBufferManager([buffer]);
  const runtime = new ChromeExtensionRuntime({
    ExtensionRuntimeClass: makeFakeExtensionRuntimeClass(calls),
    bufferManager: manager,
    getBrowserWindow: () => ({ id: 1 }),
  });
  const details = {};

  runtime.assignTabDetails(details, buffer.webContents);

  assert.deepEqual(details, {
    discarded: false,
    frozen: false,
    groupId: -1,
    active: true,
    title: "Active Tab",
    url: "https://example.test",
  });
});

test("context menu items delegate to extension package", () => {
  const calls = makeCalls();
  const buffer = makeBuffer(1, "one");
  const manager = makeBufferManager([buffer]);
  const runtime = new ChromeExtensionRuntime({
    ExtensionRuntimeClass: makeFakeExtensionRuntimeClass(calls),
    bufferManager: manager,
    getBrowserWindow: () => ({ id: 1 }),
  });

  const items = runtime.getContextMenuItems(buffer.webContents, { x: 1 });

  assert.deepEqual(items, ["extension-item"]);
  assert.deepEqual(calls.getContextMenuItems, [
    { webContents: buffer.webContents, params: { x: 1 } },
  ]);
});

const test = require("node:test");
const assert = require("node:assert/strict");

const { registerIpcContracts } = require("../core/adapters/platform/ipcRegistry");
const {
  registerSessionSecurityPolicy,
  registerWebContentsSecurityPolicy,
} = require("../core/adapters/platform/securityPolicy");
const {
  createPanelRenderTransport,
} = require("../core/adapters/renderer/panelRenderTransport");
const { pushShellPatch } = require("../core/adapters/renderer/shellPatchTransport");
const { bindWebModeTracking } = require("../core/adapters/platform/webContentsEvents");
const { createWebModeSyncService } = require("../core/webModeSyncService");
const {
  markSurfaceRole,
  SURFACE_ROLES,
} = require("../core/security/surfaceTrust");
const {
  isUsableWindow,
  attachView,
  detachView,
  setViewBounds,
  setViewAutoResize,
  setTopView,
} = require("../core/adapters/platform/contentViewHost");
const {
  openSplitDevtools,
  closeSplitDevtools,
} = require("../core/adapters/platform/devtoolsHost");
const {
  bindPaneObservers,
  readSelection,
} = require("../core/adapters/platform/webContentsObserver");

test("ipc registry registers and unregisters events and handlers symmetrically", () => {
  const eventListeners = new Map();
  const handlerListeners = new Map();
  const calls = [];
  const ipcMain = {
    on(channel, listener) {
      calls.push(["on", channel]);
      eventListeners.set(channel, listener);
    },
    handle(channel, listener) {
      calls.push(["handle", channel]);
      handlerListeners.set(channel, listener);
    },
    removeListener(channel, listener) {
      calls.push(["removeListener", channel]);
      assert.equal(eventListeners.get(channel), listener);
      eventListeners.delete(channel);
    },
    removeHandler(channel) {
      calls.push(["removeHandler", channel]);
      handlerListeners.delete(channel);
    },
  };

  const onFoo = () => {};
  const onBar = () => {};
  const onGet = async () => ({ ok: true });

  const unregister = registerIpcContracts({
    ipcMain,
    events: {
      foo: onFoo,
      bar: onBar,
      bad: null,
    },
    handlers: {
      get: onGet,
      invalid: undefined,
    },
  });

  assert.equal(eventListeners.size, 2);
  assert.equal(handlerListeners.size, 1);
  unregister();
  assert.equal(eventListeners.size, 0);
  assert.equal(handlerListeners.size, 0);

  assert.deepEqual(calls, [
    ["on", "foo"],
    ["on", "bar"],
    ["handle", "get"],
    ["removeListener", "foo"],
    ["removeListener", "bar"],
    ["removeHandler", "get"],
    ["removeHandler", "invalid"],
  ]);
});

test("session security policy enforces deny-all permission handlers", () => {
  const sessionState = {
    checkHandler: null,
    requestHandler: null,
  };
  const session = {
    defaultSession: {
      setPermissionCheckHandler(handler) {
        sessionState.checkHandler = handler;
      },
      setPermissionRequestHandler(handler) {
        sessionState.requestHandler = handler;
      },
    },
  };

  registerSessionSecurityPolicy({ session });
  assert.equal(typeof sessionState.checkHandler, "function");
  assert.equal(typeof sessionState.requestHandler, "function");
  assert.equal(sessionState.checkHandler(), false);

  let requestDecision = null;
  sessionState.requestHandler({}, "notifications", (allowed) => {
    requestDecision = allowed;
  });
  assert.equal(requestDecision, false);
});

test("webContents security policy blocks window open and denied navigation", () => {
  const notifications = [];
  let webContentsCreatedListener = null;
  const app = {
    on(eventName, listener) {
      if (eventName === "web-contents-created") {
        webContentsCreatedListener = listener;
      }
    },
  };

  registerWebContentsSecurityPolicy({
    app,
    isAllowedNavigationUrl: (url) => url === "https://allowed.test",
    notificationsService: {
      notify(entry) {
        notifications.push(entry);
      },
    },
  });

  assert.equal(typeof webContentsCreatedListener, "function");

  let windowOpenHandler = null;
  const willNavigateListeners = [];
  const contents = {
    setWindowOpenHandler(listener) {
      windowOpenHandler = listener;
    },
    on(eventName, listener) {
      if (eventName === "will-navigate") {
        willNavigateListeners.push(listener);
      }
    },
  };

  webContentsCreatedListener({}, contents);
  assert.equal(typeof windowOpenHandler, "function");
  assert.equal(willNavigateListeners.length, 1);

  const openDecision = windowOpenHandler({ url: "https://blocked-window.test" });
  assert.deepEqual(openDecision, { action: "deny" });

  let prevented = false;
  willNavigateListeners[0](
    {
      preventDefault() {
        prevented = true;
      },
    },
    "https://blocked-nav.test",
  );
  assert.equal(prevented, true);

  prevented = false;
  willNavigateListeners[0](
    {
      preventDefault() {
        prevented = true;
      },
    },
    "https://allowed.test",
  );
  assert.equal(prevented, false);

  assert.equal(notifications.length, 2);
  assert.equal(notifications[0].code, "security_window_open_blocked");
  assert.equal(notifications[1].code, "security_navigation_blocked");
});

test("webContents security policy blocks remote navigation for trusted surfaces", () => {
  let webContentsCreatedListener = null;
  const notifications = [];
  const app = {
    on(eventName, listener) {
      if (eventName === "web-contents-created") {
        webContentsCreatedListener = listener;
      }
    },
  };

  registerWebContentsSecurityPolicy({
    app,
    isAllowedNavigationUrl: () => true,
    notificationsService: {
      notify(entry) {
        notifications.push(entry);
      },
    },
  });

  const willNavigateListeners = [];
  const trustedContents = {
    setWindowOpenHandler() {},
    on(eventName, listener) {
      if (eventName === "will-navigate") {
        willNavigateListeners.push(listener);
      }
    },
  };
  markSurfaceRole(trustedContents, SURFACE_ROLES.TRUSTED_SETTINGS);
  webContentsCreatedListener({}, trustedContents);

  let prevented = false;
  willNavigateListeners[0](
    {
      preventDefault() {
        prevented = true;
      },
    },
    "https://example.com",
  );

  assert.equal(prevented, true);
  assert.equal(notifications.at(-1).code, "security_trusted_surface_navigation_blocked");
});

test("panel render transport debounces and supports cancellation", async () => {
  const urls = [];
  const webContents = {
    loadURL(url) {
      urls.push(url);
    },
  };

  const transport = createPanelRenderTransport({
    resolveWebContents: () => webContents,
    delayMs: 5,
  });

  transport.scheduleHtmlRender("<p>one</p>");
  transport.scheduleHtmlRender("<p>two</p>");
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(urls.length, 1);
  assert.match(urls[0], /^data:text\/html;charset=utf-8,/);
  assert.match(urls[0], /two/);

  transport.scheduleHtmlRender("<p>three</p>");
  transport.cancelPending();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(urls.length, 1);
});

test("webContents events adapter binds and unbinds lifecycle listeners", () => {
  const listeners = new Map();
  const webContents = {
    destroyed: false,
    isDestroyed() {
      return this.destroyed;
    },
    on(eventName, listener) {
      listeners.set(eventName, listener);
    },
    removeListener(eventName, listener) {
      if (listeners.get(eventName) === listener) {
        listeners.delete(eventName);
      }
    },
  };

  const unbind = bindWebModeTracking(webContents, {
    onFocusChangedInPage() {},
    onBeforeMouseEvent() {},
    onDidFinishLoad() {},
  });

  assert.equal(typeof listeners.get("focus-changed-in-page"), "function");
  assert.equal(typeof listeners.get("before-mouse-event"), "function");
  assert.equal(typeof listeners.get("did-finish-load"), "function");

  unbind();
  assert.equal(listeners.size, 0);
});

test("web mode sync service binds, requests sync, and unbinds safely", async () => {
  const listeners = new Map();
  const syncCalls = [];
  const webContents = {
    destroyed: false,
    isDestroyed() {
      return this.destroyed;
    },
    on(eventName, listener) {
      listeners.set(eventName, listener);
    },
    removeListener(eventName) {
      listeners.delete(eventName);
    },
  };

  const service = createWebModeSyncService({
    syncWebModeWithFocusedElement(target) {
      syncCalls.push(target);
      return Promise.resolve();
    },
    bindWebModeTracking(target, callbacks) {
      return bindWebModeTracking(target, callbacks);
    },
  });

  service.bind(webContents);
  assert.equal(service.getActiveWebContents(), webContents);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(syncCalls.length >= 1, true);

  const onBeforeMouseEvent = listeners.get("before-mouse-event");
  assert.equal(typeof onBeforeMouseEvent, "function");
  onBeforeMouseEvent(null, { type: "mouseDown" });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(syncCalls.length >= 2, true);

  service.unbind();
  assert.equal(service.getActiveWebContents(), null);
  assert.equal(listeners.size, 0);
});

test("shell patch transport executes patches and can swallow errors", async () => {
  let executedScript = null;
  const webContents = {
    isDestroyed() {
      return false;
    },
    executeJavaScript(script) {
      executedScript = script;
      return Promise.resolve("ok");
    },
  };

  const result = await pushShellPatch(webContents, "window.__x = 1;");
  assert.equal(result, "ok");
  assert.equal(executedScript, "window.__x = 1;");

  const failingWebContents = {
    isDestroyed() {
      return false;
    },
    executeJavaScript() {
      return Promise.reject(new Error("boom"));
    },
  };

  let capturedError = null;
  const swallowed = await pushShellPatch(failingWebContents, "throw new Error('boom')", {
    onError(error) {
      capturedError = error;
    },
  });
  assert.equal(swallowed, null);
  assert.equal(capturedError instanceof Error, true);
});

test("content view host adapter manages attach/detach and view primitives", () => {
  const attachedViews = [];
  const calls = [];
  const windowRef = {
    addBrowserView(view) {
      calls.push(["add", view.id]);
      attachedViews.push(view);
    },
    removeBrowserView(view) {
      calls.push(["remove", view.id]);
      const index = attachedViews.indexOf(view);
      if (index >= 0) {
        attachedViews.splice(index, 1);
      }
    },
    getBrowserViews() {
      return attachedViews.slice();
    },
    setTopBrowserView(view) {
      calls.push(["top", view.id]);
    },
  };

  const view = {
    id: "left",
    setBounds(bounds) {
      calls.push(["bounds", bounds.width, bounds.height]);
    },
    setAutoResize(options) {
      calls.push(["autoresize", Boolean(options.width), Boolean(options.height)]);
    },
  };

  attachView(windowRef, view);
  setViewBounds(view, { x: 0, y: 0, width: 10, height: 20 });
  setViewAutoResize(view, { width: true, height: false });
  setTopView(windowRef, view);
  detachView(windowRef, view);

  assert.deepEqual(calls, [
    ["add", "left"],
    ["bounds", 10, 20],
    ["autoresize", true, false],
    ["top", "left"],
    ["remove", "left"],
  ]);

  assert.equal(isUsableWindow(windowRef), true);
  assert.equal(
    isUsableWindow({ addBrowserView() {}, isDestroyed: () => true }),
    false,
  );
});

test("devtools host opens and closes split devtools safely", () => {
  const calls = [];
  const targetWebContents = {
    isDestroyed() {
      return false;
    },
    setDevToolsWebContents(webContents) {
      calls.push(["setDevToolsWebContents", webContents.id]);
    },
    openDevTools(options) {
      calls.push(["openDevTools", options.mode, options.activate]);
    },
    isDevToolsOpened() {
      return true;
    },
    closeDevTools() {
      calls.push(["closeDevTools"]);
    },
  };

  const devtoolsView = {
    webContents: {
      id: "devtools-webcontents",
      isDestroyed() {
        return false;
      },
      destroy() {
        calls.push(["destroyDevtoolsWebContents"]);
      },
    },
  };

  openSplitDevtools({ targetWebContents, devtoolsView });
  closeSplitDevtools({ targetWebContents, devtoolsView });

  assert.deepEqual(calls, [
    ["setDevToolsWebContents", "devtools-webcontents"],
    ["openDevTools", "detach", false],
    ["closeDevTools"],
    ["destroyDevtoolsWebContents"],
  ]);
});

test("webContents observer reads selection and binds lifecycle hooks", async () => {
  const listeners = new Map();
  const calls = [];
  const webContents = {
    id: 12,
    isDestroyed() {
      return false;
    },
    executeJavaScript(script) {
      calls.push(["executeJavaScript", script.includes("window.getSelection")]);
      return Promise.resolve(" selected ");
    },
    on(eventName, listener) {
      listeners.set(eventName, listener);
    },
    once(eventName, listener) {
      listeners.set(`once:${eventName}`, listener);
    },
    removeListener(eventName) {
      listeners.delete(eventName);
    },
  };

  const selected = await readSelection(webContents);
  assert.equal(selected, "selected");

  const unbind = bindPaneObservers(webContents, {
    onMouseEvent() {
      calls.push(["mouse"]);
    },
    onFocus() {
      calls.push(["focus"]);
    },
    onDestroyed() {
      calls.push(["destroyed"]);
    },
  });

  listeners.get("before-mouse-event")();
  listeners.get("focus")();
  listeners.get("once:destroyed")();
  unbind();

  assert.deepEqual(calls, [
    ["executeJavaScript", true],
    ["mouse"],
    ["focus"],
    ["destroyed"],
  ]);
});

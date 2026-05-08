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
const {
  markSurfaceRole,
  SURFACE_ROLES,
} = require("../core/security/surfaceTrust");

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

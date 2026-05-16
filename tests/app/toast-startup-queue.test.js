const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("module");

const originalLoad = Module._load;
let pushCalls = [];

Module._load = function patchedLoad(request, parent, isMain) {
  if (
    request === "../../../core/adapters/renderer/shellPatchTransport" &&
    parent &&
    parent.filename &&
    parent.filename.endsWith("ui/shell/services/auxOverlayController.js")
  ) {
    return {
      pushShellPatch(webContents, script) {
        pushCalls.push({ webContents, script });
        return Promise.resolve(48);
      },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const auxOverlayController = require("../../ui/shell/services/auxOverlayController");
Module._load = originalLoad;

function createContext(overrides = {}) {
  return {
    window: {},
    shellHostReady: false,
    toastOverlayView: { webContents: {} },
    toastOverlayReady: false,
    pendingToasts: [],
    toastOverlayHeight: 1,
    nextToastId: 1,
    currentTheme: { mainColor: "#88f", dangerTextColor: "#f44" },
    relayout() {},
    syncOverlayStack() {},
    showNotificationToast(toast) {
      return auxOverlayController.showNotificationToast.call(this, toast);
    },
    ...overrides,
  };
}

test("startup pending toasts keep up to cold-start limit", () => {
  pushCalls = [];
  const ctx = createContext();

  for (let i = 0; i < 220; i += 1) {
    auxOverlayController.showNotificationToast.call(ctx, { message: `t-${i}` });
  }

  assert.equal(ctx.pendingToasts.length, 200);
  assert.equal(ctx.pendingToasts[0].message, "t-20");
  assert.equal(ctx.pendingToasts[199].message, "t-219");
  assert.equal(pushCalls.length, 0);
});

test("flush pending toasts does not depend on shell host readiness", () => {
  pushCalls = [];
  const ctx = createContext({
    shellHostReady: false,
    toastOverlayReady: true,
    pendingToasts: [{ message: "boot-1" }, { message: "boot-2" }],
  });

  auxOverlayController.flushPendingToasts.call(ctx);

  assert.equal(ctx.pendingToasts.length, 0);
  const renderCalls = pushCalls.filter((entry) =>
    String(entry.script).includes("renderToastNode"),
  );
  assert.equal(renderCalls.length, 2);
  assert.ok(
    renderCalls.every((entry) =>
      String(entry.script).includes("root.prepend(node);"),
    ),
  );
});

test("toast script enforces max 3 displayed", async () => {
  pushCalls = [];
  const ctx = createContext({
    toastOverlayReady: true,
  });

  auxOverlayController.showNotificationToast.call(ctx, { message: "one" });
  auxOverlayController.showNotificationToast.call(ctx, { message: "two" });
  auxOverlayController.showNotificationToast.call(ctx, { message: "three" });
  auxOverlayController.showNotificationToast.call(ctx, { message: "four" });
  await new Promise((resolve) => setTimeout(resolve, 0));

  const renderCalls = pushCalls.filter((entry) =>
    String(entry.script).includes("renderToastNode"),
  );
  assert.equal(renderCalls.length, 4);
  assert.ok(String(renderCalls[0].script).includes("for (let i = 3; i < overflow.length; i += 1)"));
});

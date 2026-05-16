const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("module");

const originalLoad = Module._load;

function loadNotificationsService() {
  Module._load = function patchedLoad(request, parent, isMain) {
    if (
      request === "./store" &&
      parent &&
      parent.filename &&
      parent.filename.endsWith("core/notifications/service.js")
    ) {
      return {
        appendNotification() {},
      };
    }
    if (
      request === "../config/service" &&
      parent &&
      parent.filename &&
      parent.filename.endsWith("core/notifications/service.js")
    ) {
      return {
        getConfigValue(_key, fallback) {
          return fallback;
        },
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  const servicePath = require.resolve("../../core/notifications/service");
  delete require.cache[servicePath];
  const service = require("../../core/notifications/service");
  Module._load = originalLoad;
  return service;
}

test("toasts emitted before handler registration are flushed", () => {
  const notificationsService = loadNotificationsService();
  const seen = [];

  notificationsService.notify({
    severity: "info",
    code: "boot",
    message: "first",
  });
  notificationsService.notify({
    severity: "warning",
    code: "boot2",
    message: "second",
  });

  notificationsService.setToastHandler((toast) => {
    seen.push(toast);
  });

  assert.equal(seen.length, 2);
  assert.equal(seen[0].message, "first");
  assert.equal(seen[1].message, "second");
});

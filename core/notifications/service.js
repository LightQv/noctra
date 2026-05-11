const notificationsStore = require("./store");

let toastHandler = null;

function setToastHandler(handler) {
  toastHandler = typeof handler === "function" ? handler : null;
}

function getNotificationConfig() {
  try {
    const { getConfigValue } = require("../config/service");
    return getConfigValue("global.notifications", {});
  } catch {
    return {};
  }
}

function shouldShowToast(severity) {
  const config = getNotificationConfig();
  if (config.enabled === false) {
    return false;
  }

  const toastConfig =
    config.toast && typeof config.toast === "object" ? config.toast : {};
  if (toastConfig[severity] === false) {
    return false;
  }

  return true;
}

function getToastTimeoutMs(severity) {
  const timeoutConfig = (function resolveTimeoutConfig() {
    try {
      const { getConfigValue } = require("../config/service");
      return getConfigValue("global.notifications.timeout_ms", {}) || {};
    } catch {
      return {};
    }
  })();
  const fallback =
    severity === "error" ? 6500 : severity === "warning" ? 3600 : 2200;
  const value = timeoutConfig[severity];
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(800, Math.floor(value));
}

function shouldPersist(severity, options = {}) {
  if (typeof options.persist === "boolean") {
    return options.persist;
  }

  let persistErrors = true;
  try {
    const { getConfigValue } = require("../config/service");
    persistErrors = getConfigValue("global.notifications.persist_errors", true);
  } catch {
    persistErrors = true;
  }
  return Boolean(persistErrors) && severity === "error";
}

function writeDevLog(event) {
  const prefix = `[noctra:${event.severity}] ${event.code}`;
  const contextPart =
    event.context && typeof event.context === "object" ? event.context : {};
  if (event.severity === "error") {
    console.error(prefix, event.message, contextPart);
    return;
  }
  if (event.severity === "warning") {
    console.warn(prefix, event.message, contextPart);
    return;
  }
  console.info(prefix, event.message, contextPart);
}

function notify(input = {}) {
  const severity =
    input.severity === "error" ||
    input.severity === "warning" ||
    input.severity === "info"
      ? input.severity
      : "info";
  const code =
    typeof input.code === "string" && input.code.trim()
      ? input.code.trim()
      : "generic";
  const message = typeof input.message === "string" ? input.message : "";
  const source = typeof input.source === "string" ? input.source : "app";
  const event = {
    timestamp: new Date().toISOString(),
    severity,
    code,
    message,
    source,
    context:
      input.context && typeof input.context === "object" ? input.context : {},
  };

  writeDevLog(event);

  if (shouldPersist(severity, input)) {
    notificationsStore.appendNotification(event);
  }

  if (shouldShowToast(severity) && toastHandler) {
    if (input.toast === false) {
      return event;
    }
    toastHandler({
      severity,
      code,
      message,
      source,
      timeoutMs: getToastTimeoutMs(severity),
    });
  }

  return event;
}

module.exports = {
  notify,
  setToastHandler,
};

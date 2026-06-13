const { INTENTS } = require("../../intents");

function createMiscHandlers(deps) {
  const {
    app,
    notificationsService,
    passwordManagerService,
    quitCurrentWindowOrApp,
  } = deps;

  const notifyPasswordManagerUnavailable = (status = {}) => {
    const state = typeof status.state === "string" ? status.state : "unavailable";
    const label =
      typeof status.label === "string" && status.label.trim()
        ? status.label.trim()
        : "Password manager";
    const message =
      typeof status.message === "string" && status.message.trim()
        ? status.message.trim()
        : state === "disabled"
          ? "Password manager is disabled."
          : state === "installing"
            ? `${label} is installing.`
            : state === "loading"
              ? `${label} is loading.`
              : state === "failed"
                ? `${label} failed to initialize.`
                : `${label} is unavailable.`;

    notificationsService.notify({
      severity: state === "failed" ? "warning" : "info",
      code: "password_manager_unavailable",
      message,
      source: "core.dispatcher",
      persist: false,
    });
  };

  return {
    [INTENTS.NOOP]: () => {},
    [INTENTS.QUIT]: ({ win }) => {
      if (typeof quitCurrentWindowOrApp === "function") {
        quitCurrentWindowOrApp(win);
        return;
      }
      app.quit();
    },
    [INTENTS.PASSWORD_MANAGER_OPEN]: async () => {
      if (
        !passwordManagerService ||
        typeof passwordManagerService.open !== "function"
      ) {
        notifyPasswordManagerUnavailable();
        return;
      }

      const statusBefore =
        typeof passwordManagerService.getStatus === "function"
          ? passwordManagerService.getStatus()
          : null;
      if (!statusBefore || statusBefore.canOpen !== true) {
        notifyPasswordManagerUnavailable(statusBefore || {});
        return;
      }

      try {
        const statusAfter = await passwordManagerService.open();
        if (statusAfter && statusAfter.canOpen !== true) {
          notifyPasswordManagerUnavailable(statusAfter);
        }
      } catch (error) {
        notificationsService.notify({
          severity: "warning",
          code: "password_manager_open_failed",
          message:
            error && error.message
              ? error.message
              : "Password manager failed to open.",
          source: "core.dispatcher",
          persist: false,
        });
      }
    },
    [INTENTS.UNKNOWN_COMMAND]: ({ intent }) => {
      notificationsService.notify({
        severity: "warning",
        code: "unknown_command",
        message: `Unknown command: ${String(intent.raw || "")}`,
        source: "core.dispatcher",
        persist: false,
      });
    },
  };
}

module.exports = { createMiscHandlers };

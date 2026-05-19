const { INTENTS } = require("../../intents");

function createMiscHandlers(deps) {
  const { app, notificationsService, quitCurrentWindowOrApp } = deps;

  return {
    [INTENTS.NOOP]: () => {},
    [INTENTS.QUIT]: ({ win }) => {
      if (typeof quitCurrentWindowOrApp === "function") {
        quitCurrentWindowOrApp(win);
        return;
      }
      app.quit();
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

const { INTENTS } = require("../../intents");

function createMiscHandlers(deps) {
  const { app, notificationsService } = deps;

  return {
    [INTENTS.NOOP]: () => {},
    [INTENTS.QUIT]: () => app.quit(),
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

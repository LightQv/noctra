const { INTENTS } = require("../../intents");

function createSessionHandlers(deps) {
  const { buffers, sessionService, notificationsService } = deps;

  return {
    [INTENTS.SESSION_SAVE]: () => {
      const snapshot = buffers.exportSessionSnapshot();
      sessionService.writeSessionSnapshot(snapshot);
      notificationsService.notify({
        severity: "info",
        code: "session_snapshot_saved",
        message: "Session snapshot saved",
        source: "core.dispatcher",
        context: { path: sessionService.getSessionsFilePath() },
        persist: false,
      });
    },
    [INTENTS.SESSION_RESTORE]: () => {
      const snapshot = sessionService.readSessionSnapshot();
      const restored = buffers.restoreSessionSnapshot(snapshot);
      if (!restored) {
        notificationsService.notify({
          severity: "warning",
          code: "session_snapshot_not_found",
          message: "No restorable session snapshot found",
          source: "core.dispatcher",
          persist: false,
        });
      }
    },
  };
}

module.exports = { createSessionHandlers };
